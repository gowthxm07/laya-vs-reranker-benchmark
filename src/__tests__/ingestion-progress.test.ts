import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { DocumentParserFactory } from "../lib/parsers/parser-factory";
import { PdfDocumentParser } from "../lib/parsers/pdf-parser";
import { RAGComparisonOrchestrator } from "../server/services/rag-comparison-orchestrator";
import { CrossEncoderRerankingService } from "../server/services/cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "../server/services/laya-filtering-service";
import { MockCrossEncoderProvider } from "../lib/providers/mock-cross-encoder-provider";
import { MockLayaProvider } from "../lib/providers/mock-laya-provider";
import { MockLLMProvider } from "../lib/providers/mock-llm-provider";
import { CandidateChunkPool } from "../lib/types/candidate-pool";
import { Chunk } from "../lib/types/chunk";
import { formatElapsedSeconds } from "../lib/utils/formatters";
import { PipelineNotification } from "../lib/interfaces/observer";

describe("Phase 8.2 — PDF Ingestion and Progress Feedback", () => {
  const demoPdfPath = fs.existsSync(path.join(process.cwd(), "demo_document.pdf"))
    ? path.join(process.cwd(), "demo_document.pdf")
    : path.join(process.cwd(), "data", "demo_document.pdf");

  // --------------------------------------------------------------------------
  // Part 1: PDF Parser Selection and Text Extraction
  // --------------------------------------------------------------------------
  describe("PDF Parser Selection & Extraction", () => {
    it("selects PdfDocumentParser for .pdf files regardless of ambiguous MIME types", () => {
      const parser = DocumentParserFactory.getParser(
        "sample.pdf",
        "text/plain"
      );
      expect(parser).toBeInstanceOf(PdfDocumentParser);
    });

    it("successfully parses demo_document.pdf and extracts readable working-hours text on page 2", async () => {
      expect(fs.existsSync(demoPdfPath)).toBe(true);

      const buffer = fs.readFileSync(demoPdfPath);
      const parser = new PdfDocumentParser();
      const parsed = await parser.parse(buffer, "demo_document.pdf");

      expect(parsed.documentId).toBeTruthy();
      expect(parsed.filename).toBe("demo_document.pdf");
      expect(parsed.pageCount).toBeGreaterThanOrEqual(2);

      // Verify page 2 has the actual working-hours policy
      const page2 = parsed.pages.find((p) => p.pageNumber === 2);
      expect(page2).toBeDefined();
      expect(page2?.text).toContain(
        "Standard working hours are strictly from 9:00 AM to 6:00 PM, Monday to Friday."
      );
      expect(page2?.text).toContain("Core Collaboration Hours from 10:00 AM to 4:00 PM");

      // Verify the extracted text is clean text, not raw binary PDF markers
      expect(parsed.text).not.toContain("%PDF-");
      expect(parsed.text.length).toBeGreaterThan(100);
    });

    it("throws a clear error when parsing an empty buffer", async () => {
      const parser = new PdfDocumentParser();
      const emptyBuffer = Buffer.alloc(0);
      await expect(
        parser.parse(emptyBuffer, "empty.pdf")
      ).rejects.toThrow(/empty/i);
    });

    it("throws a clear error when parsing corrupt or non-PDF binary bytes", async () => {
      const parser = new PdfDocumentParser();
      const corruptBuffer = Buffer.from("NOT_A_VALID_PDF_HEADER_OR_CONTENT");
      await expect(
        parser.parse(corruptBuffer, "corrupt.pdf")
      ).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Part 2: Elapsed Timer Formatting & Helper Tests
  // --------------------------------------------------------------------------
  describe("Elapsed Timer Formatting", () => {
    it("formats elapsed seconds correctly into mm:ss display", () => {
      expect(formatElapsedSeconds(0)).toBe("00:00");
      expect(formatElapsedSeconds(9)).toBe("00:09");
      expect(formatElapsedSeconds(24)).toBe("00:24");
      expect(formatElapsedSeconds(60)).toBe("01:00");
      expect(formatElapsedSeconds(125)).toBe("02:05");
      expect(formatElapsedSeconds(3600)).toBe("60:00");
    });
  });

  // --------------------------------------------------------------------------
  // Part 3: Progress-Stage Lifecycle Updates & Branch Isolation
  // --------------------------------------------------------------------------
  describe("Pipeline Progress Stages & Branch Error Handling", () => {
    let mockCrossEncoder: MockCrossEncoderProvider;
    let mockLaya: MockLayaProvider;
    let mockLLM: MockLLMProvider;
    let crossEncoderService: CrossEncoderRerankingService;
    let layaService: LayaRelevanceFilteringService;
    let orchestrator: RAGComparisonOrchestrator;

    const sampleChunks: Chunk[] = [
      {
        id: "chunk-wh-1",
        documentId: "demo-doc",
        text: "Standard operating hours are Monday through Friday, 09:00 to 18:00.",
        source: "demo_document.pdf",
        pageNumber: 2,
        retrievalScore: 0.95,
        rank: 1,
      },
      {
        id: "chunk-wh-2",
        documentId: "demo-doc",
        text: "Core collaboration hours are 10:00 to 16:00 UTC.",
        source: "demo_document.pdf",
        pageNumber: 2,
        retrievalScore: 0.88,
        rank: 2,
      },
    ];

    const testPool: CandidateChunkPool = {
      id: "pool-demo-test",
      query: "What are the standard working hours?",
      candidateChunks: sampleChunks,
      totalCandidates: 2,
      retrievalConfig: { topK: 2, embeddingModel: "nomic-embed-text" },
      retrievalLatencyMs: 25,
      embeddingModel: "nomic-embed-text",
      retrievedAt: Date.now(),
    };

    beforeEach(() => {
      mockCrossEncoder = new MockCrossEncoderProvider();
      mockLaya = new MockLayaProvider();
      mockLLM = new MockLLMProvider();

      crossEncoderService = new CrossEncoderRerankingService(mockCrossEncoder);
      layaService = new LayaRelevanceFilteringService(mockLaya);

      orchestrator = new RAGComparisonOrchestrator({
        crossEncoderService,
        layaService,
        llmProvider: mockLLM,
      });
    });

    it("emits discrete progress observer notifications across all 7 pipeline stages", async () => {
      mockCrossEncoder.setFixedScores([2.5, 1.2]);
      mockLaya.setFixedDecisions(["keep", "keep"]);

      const emittedNotifications: PipelineNotification[] = [];

      orchestrator.getObservable().addObserver({
        id: "test-progress-listener",
        onEvent(notification) {
          emittedNotifications.push(notification);
        },
      });

      const result = await orchestrator.compareCandidatePool(testPool);

      expect(result).toBeDefined();
      expect(result.crossEncoder.answer).toBeTruthy();
      expect(result.laya.answer).toBeTruthy();

      // Check key lifecycle phases are emitted
      const phases = emittedNotifications.map((n) => n.event.phase);
      expect(phases).toContain("chunks_retrieved"); // start
      expect(phases).toContain("relevance_evaluation_started"); // CE / Laya eval
      expect(phases).toContain("relevance_evaluation_completed");
      expect(phases).toContain("context_built"); // context preparation
      expect(phases).toContain("generation_started"); // answer generation
      expect(phases).toContain("generation_completed");
      expect(phases).toContain("metrics_calculated"); // finalization
    });

    it("successfully completes Laya branch when Cross-Encoder branch fails", async () => {
      mockCrossEncoder.setFixedScores([]);
      // Simulate Cross-Encoder failure
      const failingCEService = {
        rerankPool: async () => {
          throw new Error("Simulated Cross-Encoder hardware fault");
        },
      } as unknown as CrossEncoderRerankingService;

      mockLaya.setFixedDecisions(["keep", "keep"]);

      const partialOrchestrator = new RAGComparisonOrchestrator({
        crossEncoderService: failingCEService,
        layaService,
        llmProvider: mockLLM,
      });

      const result = await partialOrchestrator.compareCandidatePool(testPool);

      // Path A failed cleanly
      expect(result.crossEncoder.error).toContain(
        "Simulated Cross-Encoder hardware fault"
      );
      expect(result.crossEncoder.retainedCount).toBe(0);

      // Path B completed successfully
      expect(result.laya.error).toBeUndefined();
      expect(result.laya.retainedCount).toBe(2);
      expect(result.laya.answer).toBeTruthy();
      expect(result.laya.totalLatencyMs).toBeGreaterThan(0);
    });

    it("successfully completes Cross-Encoder branch when Laya branch fails", async () => {
      mockCrossEncoder.setFixedScores([3.0, 1.5]);

      // Simulate Laya evaluation failure / timeout
      const failingLayaService = {
        filterPool: async () => {
          throw new Error("Simulated Laya CPU worker timeout");
        },
      } as unknown as LayaRelevanceFilteringService;

      const partialOrchestrator = new RAGComparisonOrchestrator({
        crossEncoderService,
        layaService: failingLayaService,
        llmProvider: mockLLM,
      });

      const result = await partialOrchestrator.compareCandidatePool(testPool);

      // Path A completed successfully
      expect(result.crossEncoder.error).toBeUndefined();
      expect(result.crossEncoder.retainedCount).toBe(2);
      expect(result.crossEncoder.answer).toBeTruthy();

      // Path B recorded error distinctly
      expect(result.laya.error).toContain("Simulated Laya CPU worker timeout");
      expect(result.laya.retainedCount).toBe(0);
      expect(result.laya.answer).toContain("Generation failed for this branch");
    });
  });
});
