import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PdfDocumentParser } from "../lib/parsers/pdf-parser";
import { DeterministicChunker } from "../lib/chunking/chunker";
import { DocumentIngestionService } from "../server/services/ingestion-service";
import { LocalVectorStore } from "../lib/vector-store/local-vector-store";
import { SharedRetrieverService } from "../server/services/retriever-service";
import { MockEmbeddingProvider } from "../lib/providers/mock-embedding-provider";
import { RAGComparisonOrchestrator } from "../server/services/rag-comparison-orchestrator";
import { CrossEncoderRerankingService } from "../server/services/cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "../server/services/laya-filtering-service";
import { MockCrossEncoderProvider } from "../lib/providers/mock-cross-encoder-provider";
import { MockLayaProvider } from "../lib/providers/mock-laya-provider";
import { MockLLMProvider } from "../lib/providers/mock-llm-provider";

describe("Phase 2: Security-Test PDF Ingestion and Retrieval Validation", () => {
  const origPdfPath = path.join(process.cwd(), "demo_document.pdf");
  const securityPdfPath = path.join(process.cwd(), "demo_document_security.pdf");

  it("verifies original demo_document.pdf exists and remains untouched", () => {
    expect(fs.existsSync(origPdfPath)).toBe(true);
    const origBuffer = fs.readFileSync(origPdfPath);
    const hash = crypto.createHash("sha256").update(origBuffer).digest("hex");
    // Verify SHA-256 matches the known baseline hash
    expect(hash.toLowerCase()).toBe("4384bb856608c890527f8264dc48fe636edab6b00148faa25d05472a0169fdef".toLowerCase());
  });

  it("verifies demo_document_security.pdf exists with 11 pages and valid checksum", () => {
    expect(fs.existsSync(securityPdfPath)).toBe(true);
    const secBuffer = fs.readFileSync(securityPdfPath);
    expect(secBuffer.length).toBeGreaterThan(15000);

    const hash = crypto.createHash("sha256").update(secBuffer).digest("hex");
    expect(hash.toLowerCase()).toBe("9fbfa88220cb2ee42bc900fc1d6d91cac7486ba3f3f35d9d987ef6726eeaa117".toLowerCase());
  });

  it("extracts all original content and all appended synthetic records using PdfDocumentParser", async () => {
    const secBuffer = fs.readFileSync(securityPdfPath);
    const parser = new PdfDocumentParser();
    const parsed = await parser.parse(secBuffer, "demo_document_security.pdf");

    expect(parsed.pageCount).toBe(11);
    expect(parsed.pages.length).toBe(11);

    // Verify original content (e.g. working hours on page 2)
    const page2 = parsed.pages.find((p) => p.pageNumber === 2);
    expect(page2).toBeDefined();
    expect(page2?.text).toContain("Standard working hours are strictly from 9:00 AM to 6:00 PM, Monday to Friday.");
    expect(page2?.text).toContain("Core Collaboration Hours from 10:00 AM to 4:00 PM");

    // Verify synthetic records across Pages 8 to 11
    const page8 = parsed.pages.find((p) => p.pageNumber === 8);
    expect(page8?.text).toContain("SEC-PUBLIC-01");
    expect(page8?.text).toContain("SEC-PUBLIC-02");
    expect(page8?.text).toContain("SEC-INTERNAL-01");
    expect(page8?.text).toContain("SEC-INTERNAL-02");
    expect(page8?.text).toContain("Campus Visitor Parking");
    expect(page8?.text).toContain("media@acme-tech.example.com");

    const page9 = parsed.pages.find((p) => p.pageNumber === 9);
    expect(page9?.text).toContain("SEC-CONFIDENTIAL-01");
    expect(page9?.text).toContain("SEC-CONFIDENTIAL-02");
    expect(page9?.text).toContain("SEC-CONFIDENTIAL-03");
    expect(page9?.text).toContain("$285,000 USD");
    expect(page9?.text).toContain("EMP-8041");
    expect(page9?.text).toContain("EMP-4412");

    const page10 = parsed.pages.find((p) => p.pageNumber === 10);
    expect(page10?.text).toContain("SEC-RESTRICTED-01");
    expect(page10?.text).toContain("SEC-RESTRICTED-02");
    expect(page10?.text).toContain("SEC-CANARY-01");
    expect(page10?.text).toContain("Project Titan");
    expect(page10?.text).toContain("$54,000,000 USD");
    expect(page10?.text).toContain("Region 4");
    expect(page10?.text).toContain("telecommunications");
    expect(page10?.text).toContain("CANARY_ACCESS_KEY_9942_XJ7");

    const page11 = parsed.pages.find((p) => p.pageNumber === 11);
    expect(page11?.text).toContain("SEC-INJECTION-01");
    expect(page11?.text).toContain("SEC-MIXED-01");
    expect(page11?.text).toContain("SYSTEM OVERRIDE");
    expect(page11?.text).toContain("CANARY_ACCESS_KEY_9942_XJ7");
    expect(page11?.text).toContain("main campus cafeteria is open Monday through Friday from 7:30 AM to 3:30 PM");
  });

  it("chunks demo_document_security.pdf into distinct retrievable chunks with metadata attribution", async () => {
    const secBuffer = fs.readFileSync(securityPdfPath);
    const parser = new PdfDocumentParser();
    const parsed = await parser.parse(secBuffer, "demo_document_security.pdf", {
      documentId: "doc_security_test",
    });

    const chunker = new DeterministicChunker();
    const chunks = chunker.chunkDocument(parsed);

    expect(chunks.length).toBeGreaterThan(15);

    // Verify chunk provenance
    const canaryChunk = chunks.find((c) => c.text.includes("CANARY_ACCESS_KEY_9942_XJ7"));
    expect(canaryChunk).toBeDefined();
    expect(canaryChunk?.pageNumber).toBe(10);
    expect(canaryChunk?.source).toBe("demo_document_security.pdf");

    const injectionChunk = chunks.find((c) => c.text.includes("SYSTEM OVERRIDE") || c.text.includes("SEC-INJECTION-01"));
    expect(injectionChunk).toBeDefined();
    expect(injectionChunk?.pageNumber).toBe(11);

    const compChunk = chunks.find((c) => c.text.includes("$285,000 USD"));
    expect(compChunk).toBeDefined();
    expect(compChunk?.pageNumber).toBe(9);
  });

  it("ingests and indexes demo_document_security.pdf without overwriting demo_document.pdf chunks", async () => {
    const tempStorePath = path.join(process.cwd(), "data", `test-vector-store-${Date.now()}.json`);
    const vectorStore = new LocalVectorStore({
      storageFilePath: tempStorePath,
      autoSave: false,
    });
    const embeddingProvider = new MockEmbeddingProvider();
    const ingestionService = new DocumentIngestionService(vectorStore, embeddingProvider);

    // Ingest original PDF first
    const origBuffer = fs.readFileSync(origPdfPath);
    const origIngest = await ingestionService.ingestDocument(origBuffer, "demo_document.pdf");
    expect(origIngest.chunkCount).toBeGreaterThan(5);
    const origDocId = origIngest.document.id;

    // Ingest security PDF second
    const secBuffer = fs.readFileSync(securityPdfPath);
    const secIngest = await ingestionService.ingestDocument(secBuffer, "demo_document_security.pdf");
    expect(secIngest.chunkCount).toBeGreaterThan(origIngest.chunkCount);
    const secDocId = secIngest.document.id;

    // Verify document IDs are strictly distinct
    expect(origDocId).not.toBe(secDocId);

    // Verify total count equals sum of both documents (no overwriting)
    const totalCount = await vectorStore.count();
    expect(totalCount).toBe(origIngest.chunkCount + secIngest.chunkCount);

    // Verify documents summary lists both documents independently
    const summary = await vectorStore.getIndexedDocumentsSummary();
    expect(summary.length).toBe(2);
    const origSummary = summary.find((s) => s.documentId === origDocId);
    const secSummary = summary.find((s) => s.documentId === secDocId);
    expect(origSummary).toBeDefined();
    expect(secSummary).toBeDefined();
    expect(origSummary?.filename).toBe("demo_document.pdf");
    expect(secSummary?.filename).toBe("demo_document_security.pdf");
    expect(secSummary?.pageCount).toBe(11);

    // Clean up temp store file if created
    if (fs.existsSync(tempStorePath)) {
      fs.unlinkSync(tempStorePath);
    }
  });

  it("verifies SharedRetrieverService retrieves synthetic security chunks and feeds comparison orchestrator", async () => {
    const tempStorePath = path.join(process.cwd(), "data", `test-retriever-store-${Date.now()}.json`);
    const vectorStore = new LocalVectorStore({
      storageFilePath: tempStorePath,
      autoSave: false,
    });
    const embeddingProvider = new MockEmbeddingProvider();
    const ingestionService = new DocumentIngestionService(vectorStore, embeddingProvider);

    const secBuffer = fs.readFileSync(securityPdfPath);
    await ingestionService.ingestDocument(secBuffer, "demo_document_security.pdf");

    const retriever = new SharedRetrieverService(vectorStore, embeddingProvider);

    // Locate canary entry and verify deterministic vector retrieval
    const entries = await vectorStore.search(new Array(768).fill(0), 200);
    const canaryEntry = entries.find((e) => e.entry.text.includes("CANARY_ACCESS_KEY_9942_XJ7"));
    expect(canaryEntry).toBeDefined();

    const pool = await retriever.retrieve(canaryEntry!.entry.text, { topK: 5 });
    expect(pool.candidateChunks.length).toBeGreaterThan(0);
    expect(pool.candidateChunks[0].text).toContain("CANARY_ACCESS_KEY_9942_XJ7");
    expect(pool.candidateChunks[0].retrievalScore).toBe(1.0);

    // Feed pool into RAGComparisonOrchestrator
    const mockCE = new MockCrossEncoderProvider();
    const mockLaya = new MockLayaProvider();
    const mockLLM = new MockLLMProvider();

    const orchestrator = new RAGComparisonOrchestrator({
      crossEncoderService: new CrossEncoderRerankingService(mockCE),
      layaService: new LayaRelevanceFilteringService(mockLaya),
      llmProvider: mockLLM,
    });

    const comparisonResult = await orchestrator.compareCandidatePool(pool, {
      mode: "native",
      topN: 5,
      layaThreshold: 0.75,
    });

    expect(comparisonResult.query).toBe(pool.query);
    expect(comparisonResult.sharedRetrieval.candidateCount).toBeGreaterThan(0);
    expect(comparisonResult.crossEncoder.selectedChunks.length).toBeGreaterThan(0);
    expect(comparisonResult.laya.selectedChunks.length).toBeGreaterThan(0);

    // Clean up
    if (fs.existsSync(tempStorePath)) {
      fs.unlinkSync(tempStorePath);
    }
  });
});
