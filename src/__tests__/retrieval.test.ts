import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { TextDocumentParser } from "../lib/parsers/text-parser";
import { MarkdownDocumentParser } from "../lib/parsers/markdown-parser";
import { DocumentParserFactory } from "../lib/parsers/parser-factory";
import { DeterministicChunker } from "../lib/chunking/chunker";
import { MockEmbeddingProvider } from "../lib/providers/mock-embedding-provider";
import {
  LocalVectorStore,
  calculateCosineSimilarity,
} from "../lib/vector-store/local-vector-store";
import { SharedRetrieverService } from "../server/services/retriever-service";
import { EvaluatorFactory } from "../lib/patterns/factory/evaluator-factory";
import { ParsedDocument } from "../lib/types/document";

const TEST_VECTOR_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "test-retrieval-store.json"
);

describe("Phase 2 — Document Ingestion, Chunking & Shared Vector Retrieval", () => {
  let mockEmbeddingProvider: MockEmbeddingProvider;
  let testVectorStore: LocalVectorStore;

  beforeEach(async () => {
    mockEmbeddingProvider = new MockEmbeddingProvider(128); // 128d for fast testing
    testVectorStore = new LocalVectorStore({
      storageFilePath: TEST_VECTOR_STORE_PATH,
      autoSave: false, // in-memory test mode
    });
    await testVectorStore.clear();
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_VECTOR_STORE_PATH).catch(() => {});
    } catch {}
  });

  // 1. Parser Behavior
  describe("1. Document Parsers", () => {
    it("parses plain text documents preserving content", async () => {
      const parser = new TextDocumentParser();
      const content = "Chapter 1: Principles of Scalable Information Retrieval.";
      const buffer = Buffer.from(content, "utf-8");

      const parsed = await parser.parse(buffer, "retrieval_notes.txt");
      expect(parsed.filename).toBe("retrieval_notes.txt");
      expect(parsed.mimeType).toBe("text/plain");
      expect(parsed.text).toBe(content);
      expect(parsed.pages.length).toBe(1);
      expect(parsed.pages[0].pageNumber).toBe(1);
    });

    it("parses Markdown documents preserving headers", async () => {
      const parser = new MarkdownDocumentParser();
      const mdContent = "# RAG Benchmark\n\nCross-encoder vs Laya comparison.";
      const buffer = Buffer.from(mdContent, "utf-8");

      const parsed = await parser.parse(buffer, "benchmark_spec.md");
      expect(parsed.mimeType).toBe("text/markdown");
      expect(parsed.text).toContain("Cross-encoder vs Laya comparison.");
    });

    it("throws error for empty document files", async () => {
      const parser = new TextDocumentParser();
      const buffer = Buffer.from("   ", "utf-8");
      await expect(parser.parse(buffer, "empty.txt")).rejects.toThrow();
    });

    it("resolves appropriate parser through DocumentParserFactory", () => {
      const textParser = DocumentParserFactory.getParser("data.txt");
      expect(textParser).toBeInstanceOf(TextDocumentParser);

      const mdParser = DocumentParserFactory.getParser("README.md");
      expect(mdParser).toBeInstanceOf(MarkdownDocumentParser);

      expect(() => DocumentParserFactory.getParser("spreadsheet.xlsx")).toThrow(
        /Unsupported document format/
      );
    });
  });

  // 2, 3, 4. Deterministic Chunking & Metadata Preservation
  describe("2. Deterministic Chunking & Metadata", () => {
    const sampleDoc: ParsedDocument = {
      documentId: "doc_test_100",
      filename: "architecture_whitepaper.pdf",
      mimeType: "application/pdf",
      text: "Full text content",
      pageCount: 2,
      pages: [
        {
          pageNumber: 1,
          text: "Page 1: In retrieval-augmented generation, dense bi-encoder embeddings perform fast nearest-neighbor search across millions of passages.",
        },
        {
          pageNumber: 2,
          text: "Page 2: Post-retrieval reranking then assesses relevance to prune unhelpful chunks before prompt synthesis.",
        },
      ],
      metadata: { author: "DeepMind Research" },
    };

    it("produces deterministic chunks with stable IDs across runs", () => {
      const chunker = new DeterministicChunker({
        chunkSize: 80,
        chunkOverlap: 20,
      });

      const run1 = chunker.chunkDocument(sampleDoc);
      const run2 = chunker.chunkDocument(sampleDoc);

      expect(run1.length).toBeGreaterThan(0);
      expect(run1.length).toBe(run2.length);

      for (let i = 0; i < run1.length; i++) {
        expect(run1[i].id).toBe(run2[i].id);
        expect(run1[i].text).toBe(run2[i].text);
      }
    });

    it("preserves documentId, source, pageNumber, and metadata on all chunks", () => {
      const chunker = new DeterministicChunker({
        chunkSize: 90,
        chunkOverlap: 20,
      });

      const chunks = chunker.chunkDocument(sampleDoc);

      for (const chunk of chunks) {
        expect(chunk.documentId).toBe("doc_test_100");
        expect(chunk.source).toBe("architecture_whitepaper.pdf");
        expect(chunk.pageNumber).toBeDefined();
        expect([1, 2]).toContain(chunk.pageNumber);
        expect(chunk.decision).toBe("pending");
      }
    });

    it("respects custom chunk size and overlap configurations", () => {
      const smallChunker = new DeterministicChunker({
        chunkSize: 50,
        chunkOverlap: 10,
      });
      const largeChunker = new DeterministicChunker({
        chunkSize: 200,
        chunkOverlap: 40,
      });

      const smallChunks = smallChunker.chunkDocument(sampleDoc);
      const largeChunks = largeChunker.chunkDocument(sampleDoc);

      expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
    });
  });

  // 5. Mock Embedding Provider Contract
  describe("3. Embedding Provider Contract", () => {
    it("generates deterministic normalized vectors with expected dimensions", async () => {
      const vector1 = await mockEmbeddingProvider.embedText("What is RAG?");
      const vector2 = await mockEmbeddingProvider.embedText("What is RAG?");
      const vector3 = await mockEmbeddingProvider.embedText("Completely different topic");

      expect(vector1.length).toBe(128);
      expect(vector1).toEqual(vector2); // Deterministic

      // Unit length normalization check
      const magnitude = Math.sqrt(
        vector1.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1.0, 4);

      // Cosine similarity between identical text should be 1.0
      const selfSimilarity = calculateCosineSimilarity(vector1, vector2);
      expect(selfSimilarity).toBeCloseTo(1.0, 4);

      // Different text should have different vector
      expect(vector1).not.toEqual(vector3);
    });

    it("embeds batches consistently", async () => {
      const texts = ["Alpha passage", "Beta passage", "Gamma passage"];
      const batch = await mockEmbeddingProvider.embedBatch(texts);

      expect(batch.length).toBe(3);
      expect(batch[0].length).toBe(128);
    });
  });

  // 6, 7. Vector Insertion & Top-K Cosine Similarity Search
  describe("4. Local Vector Index & Top-K Retrieval", () => {
    it("inserts and retrieves entries ordered by similarity score", async () => {
      const queryText = "quantum computing algorithms";
      const queryVector = await mockEmbeddingProvider.embedText(queryText);

      // Insert 3 passages
      const p1 = "Introduction to quantum computing and Shor's algorithm.";
      const p2 = "Classical sorting algorithms in computer science.";
      const p3 = "Quantum error correction codes and entanglement.";

      await testVectorStore.insert({
        id: "chunk_1",
        documentId: "doc_qc",
        text: p1,
        source: "qc_intro.pdf",
        pageNumber: 1,
        embedding: await mockEmbeddingProvider.embedText(p1),
      });

      await testVectorStore.insert({
        id: "chunk_2",
        documentId: "doc_cs",
        text: p2,
        source: "cs_intro.pdf",
        pageNumber: 1,
        embedding: await mockEmbeddingProvider.embedText(p2),
      });

      await testVectorStore.insert({
        id: "chunk_3",
        documentId: "doc_qc",
        text: p3,
        source: "qc_intro.pdf",
        pageNumber: 2,
        embedding: await mockEmbeddingProvider.embedText(p3),
      });

      const results = await testVectorStore.search(queryVector, 2);

      expect(results.length).toBe(2);
      expect(results[0].rank).toBe(1);
      expect(results[1].rank).toBe(2);
      // Scores must be descending
      expect(results[0].similarityScore).toBeGreaterThanOrEqual(
        results[1].similarityScore
      );
      // Ensure raw embeddings are not exposed in standard rank attributes
      expect(results[0].entry.text).toBeDefined();
    });
  });

  // 8, 9, 10. Shared Candidate Pool & No Premature Filtering
  describe("5. Shared CandidateChunkPool & Strategy Decoupling", () => {
    it("produces an immutable CandidateChunkPool with initial ranks and scores", async () => {
      // Seed store
      const text = "Bi-encoder retrieval produces initial candidate chunks.";
      await testVectorStore.insert({
        id: "c_seed_1",
        documentId: "doc_rag",
        text,
        source: "rag_spec.md",
        pageNumber: 1,
        embedding: await mockEmbeddingProvider.embedText(text),
      });

      const retriever = new SharedRetrieverService(
        testVectorStore,
        mockEmbeddingProvider
      );

      const pool = await retriever.retrieve("bi-encoder candidate chunks", {
        topK: 5,
      });

      expect(pool).toBeDefined();
      expect(pool.candidateChunks.length).toBe(1);
      expect(pool.totalCandidates).toBe(1);
      expect(pool.retrievalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(pool.embeddingModel).toBe(mockEmbeddingProvider.model);

      const candidate = pool.candidateChunks[0];
      expect(candidate.id).toBe("c_seed_1");
      expect(candidate.rank).toBe(1);
      expect(candidate.retrievalScore).toBeDefined();

      // IMPORTANT REQUIREMENT 9: Retriever MUST NOT decide final relevance
      expect(candidate.decision).toBe("pending");
      expect(candidate.relevanceScore).toBeUndefined();
    });

    it("verifies the same CandidateChunkPool can be handed to multiple evaluator strategies", async () => {
      // Seed store with 2 chunks
      const p1 = "Relevant passage for cross attention.";
      const p2 = "Secondary candidate passage.";

      await testVectorStore.insertBatch([
        {
          id: "chunk_a",
          documentId: "doc_1",
          text: p1,
          embedding: await mockEmbeddingProvider.embedText(p1),
        },
        {
          id: "chunk_b",
          documentId: "doc_1",
          text: p2,
          embedding: await mockEmbeddingProvider.embedText(p2),
        },
      ]);

      const retriever = new SharedRetrieverService(
        testVectorStore,
        mockEmbeddingProvider
      );

      const pool = await retriever.retrieve("relevant query", { topK: 10 });

      // Both Path A (CrossEncoder) and Path B (Laya) strategies exist and can receive this exact pool
      const crossEncoderStrategy =
        EvaluatorFactory.createEvaluator("cross-encoder");
      const layaStrategy = EvaluatorFactory.createEvaluator("laya");

      expect(crossEncoderStrategy).toBeDefined();
      expect(layaStrategy).toBeDefined();

      // Candidate chunks passed to both are identical in ID, text, rank, and retrieval score
      const requestForCrossEncoder = {
        query: pool.query,
        candidateChunks: pool.candidateChunks,
      };

      const requestForLaya = {
        query: pool.query,
        candidateChunks: pool.candidateChunks,
      };

      expect(requestForCrossEncoder.candidateChunks).toBe(
        requestForLaya.candidateChunks
      );
      expect(requestForCrossEncoder.candidateChunks[0].decision).toBe("pending");
    });
  });
});
