import { describe, it, expect, beforeEach } from "vitest";
import { MockCrossEncoderProvider } from "../lib/providers/mock-cross-encoder-provider";
import { CrossEncoderRerankingService } from "../server/services/cross-encoder-reranking-service";
import { CandidateChunkPool } from "../lib/types/candidate-pool";
import { Chunk } from "../lib/types/chunk";
import { CrossEncoderEvaluator } from "../lib/patterns/strategy/relevance-strategy";
import { CrossEncoderProvider } from "../lib/interfaces/cross-encoder-provider";

describe("Phase 3 — Advanced RAG Cross-Encoder Reranking", () => {
  let mockProvider: MockCrossEncoderProvider;
  let rerankingService: CrossEncoderRerankingService;

  const sampleChunks: Chunk[] = [
    {
      id: "chunk-1",
      documentId: "doc-attention",
      text: "Standard multi-head attention suffers from quadratic time and space complexity O(N^2) with sequence length.",
      source: "attention_mechanisms.md",
      pageNumber: 1,
      rank: 1,
      retrievalScore: 0.89,
      decision: "pending",
    },
    {
      id: "chunk-2",
      documentId: "doc-attention",
      text: "Linear attention approximations like Fast Attention with Positive Orthogonal Random Features reduce complexity to O(N).",
      source: "attention_mechanisms.md",
      pageNumber: 2,
      rank: 2,
      retrievalScore: 0.85,
      decision: "pending",
    },
    {
      id: "chunk-3",
      documentId: "doc-attention",
      text: "FlashAttention optimizes GPU memory hierarchy using SRAM tiling rather than changing mathematical complexity.",
      source: "attention_mechanisms.md",
      pageNumber: 3,
      rank: 3,
      retrievalScore: 0.82,
      decision: "pending",
    },
    {
      id: "chunk-4",
      documentId: "doc-attention",
      text: "In computer vision, convolutional neural networks process images using sliding 2D kernel matrices.",
      source: "vision_models.md",
      pageNumber: 1,
      rank: 4,
      retrievalScore: 0.78,
      decision: "pending",
    },
    {
      id: "chunk-5",
      documentId: "doc-attention",
      text: "AdamW optimizer introduces decoupled weight decay to improve gradient descent convergence stability.",
      source: "optimizers.md",
      pageNumber: 1,
      rank: 5,
      retrievalScore: 0.72,
      decision: "pending",
    },
  ];

  const samplePool: CandidateChunkPool = {
    id: "pool-unit-test-123",
    query: "What linear attention mechanism addresses quadratic complexity?",
    retrievedAt: 1710000000000,
    candidateChunks: sampleChunks,
    totalCandidates: 5,
    retrievalConfig: {
      topK: 5,
      embeddingModel: "nomic-embed-text",
    },
    embeddingModel: "nomic-embed-text",
    retrievalLatencyMs: 42,
  };

  beforeEach(() => {
    mockProvider = new MockCrossEncoderProvider();
    rerankingService = new CrossEncoderRerankingService(mockProvider);
  });

  // 1. Candidate Preservation
  it("Scenario 1: preserves all candidate chunks from the input pool", async () => {
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    expect(result.candidates.length).toBe(5);
    expect(result.topKRetrieved).toBe(5);
    const resultIds = new Set(result.candidates.map((c) => c.id));
    sampleChunks.forEach((c) => {
      expect(resultIds.has(c.id)).toBe(true);
    });
  });

  // 2. Chunk IDs matched
  it("Scenario 2: attaches cross-encoder scores to the correct chunk IDs", async () => {
    // Custom scores for known chunk texts
    mockProvider.setFixedScores([1.2, 8.5, 4.1, -3.2, -6.8]);
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    const chunk2 = result.candidates.find((c) => c.id === "chunk-2");
    expect(chunk2).toBeDefined();
    expect(chunk2?.crossEncoderScore).toBe(8.5);

    const chunk4 = result.candidates.find((c) => c.id === "chunk-4");
    expect(chunk4).toBeDefined();
    expect(chunk4?.crossEncoderScore).toBe(-3.2);
  });

  // 3. Ranking order
  it("Scenario 3: orders candidates strictly descending by cross-encoder score", async () => {
    mockProvider.setFixedScores([2.0, 9.5, 5.0, -1.0, 0.5]);
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    // Expect ranks: chunk-2 (9.5) -> chunk-3 (5.0) -> chunk-1 (2.0) -> chunk-5 (0.5) -> chunk-4 (-1.0)
    expect(result.candidates[0].id).toBe("chunk-2");
    expect(result.candidates[0].rerankedRank).toBe(1);
    expect(result.candidates[0].crossEncoderScore).toBe(9.5);

    expect(result.candidates[1].id).toBe("chunk-3");
    expect(result.candidates[1].rerankedRank).toBe(2);

    expect(result.candidates[2].id).toBe("chunk-1");
    expect(result.candidates[2].rerankedRank).toBe(3);

    expect(result.candidates[3].id).toBe("chunk-5");
    expect(result.candidates[3].rerankedRank).toBe(4);

    expect(result.candidates[4].id).toBe("chunk-4");
    expect(result.candidates[4].rerankedRank).toBe(5);

    // Verify strict descending monotonicity
    for (let i = 0; i < result.candidates.length - 1; i++) {
      expect(result.candidates[i].crossEncoderScore).toBeGreaterThanOrEqual(
        result.candidates[i + 1].crossEncoderScore
      );
    }
  });

  // 4. Metadata preservation
  it("Scenario 4: preserves original retrieval score, initial rank, page number, and source", async () => {
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    const chunk1 = result.candidates.find((c) => c.id === "chunk-1")!;
    expect(chunk1.originalRetrievalScore).toBe(0.89);
    expect(chunk1.originalRank).toBe(1);
    expect(chunk1.pageNumber).toBe(1);
    expect(chunk1.source).toBe("attention_mechanisms.md");
    expect(chunk1.documentId).toBe("doc-attention");
    expect(chunk1.text).toBe(sampleChunks[0].text);
  });

  // 5. Top-N selection
  it("Scenario 5: selects highest N candidates and marks remainder as discarded", async () => {
    mockProvider.setFixedScores([10.0, 8.0, 6.0, 4.0, 2.0]);
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    expect(result.topNSelected).toBe(3);
    expect(result.selectedCandidates.length).toBe(3);

    // The top 3 should be selected and retained
    result.candidates.slice(0, 3).forEach((chunk) => {
      expect(chunk.isSelected).toBe(true);
      expect(chunk.decision).toBe("retained");
    });

    // The remaining 2 should NOT be selected and marked discarded
    result.candidates.slice(3).forEach((chunk) => {
      expect(chunk.isSelected).toBe(false);
      expect(chunk.decision).toBe("discarded");
    });
  });

  // 6. Same candidate pool preserved
  it("Scenario 6: maintains pool lineage and does not perform re-retrieval", async () => {
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    expect(result.originalPoolId).toBe(samplePool.id);
    expect(result.query).toBe(samplePool.query);
    expect(result.retrievedAt).toBe(samplePool.retrievedAt);
    expect(result.embeddingModel).toBe(samplePool.embeddingModel);
  });

  // 7. Empty candidate pool handling
  it("Scenario 7: handles empty candidate pool cleanly without errors", async () => {
    const emptyPool: CandidateChunkPool = {
      id: "pool-empty",
      query: "empty query",
      retrievedAt: Date.now(),
      candidateChunks: [],
      totalCandidates: 0,
      retrievalConfig: { topK: 5, embeddingModel: "nomic-embed-text" },
      embeddingModel: "nomic-embed-text",
      retrievalLatencyMs: 0,
    };

    const result = await rerankingService.rerankPool(emptyPool, { topN: 3 });

    expect(result.topKRetrieved).toBe(0);
    expect(result.topNSelected).toBe(0);
    expect(result.candidates).toEqual([]);
    expect(result.selectedCandidates).toEqual([]);
    expect(result.metrics.candidateCount).toBe(0);
  });

  // 8. Provider failure handling
  it("Scenario 8: throws meaningful error when cross-encoder provider fails", async () => {
    const failingProvider: CrossEncoderProvider = {
      id: "failing-mock",
      model: "test-failing-model",
      predictScores: async () => {
        throw new Error("Python cross-encoder process terminated unexpectedly.");
      },
      checkHealth: async () => ({ isAvailable: false }),
    };

    const failingService = new CrossEncoderRerankingService(failingProvider);

    await expect(
      failingService.rerankPool(samplePool, { topN: 3 })
    ).rejects.toThrow("Python cross-encoder process terminated unexpectedly.");
  });

  // 9. Latency metrics validation
  it("Scenario 9: calculates evaluation, average candidate, and total latency correctly", async () => {
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    expect(result.metrics.candidateCount).toBe(5);
    expect(result.metrics.evaluationLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.averageCandidateLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.metrics.isColdStart).toBe("boolean");
  });

  // 10. Batch behavior
  it("Scenario 10: passes all candidate texts in a single batch to the provider", async () => {
    let callCount = 0;
    let batchSize = 0;

    const batchTrackingProvider: CrossEncoderProvider = {
      id: "batch-tracking-mock",
      model: "batch-tracking-model",
      predictScores: async (_query, texts) => {
        callCount++;
        batchSize = texts.length;
        return {
          scores: texts.map(() => 1.0),
          modelLoadLatencyMs: 0,
          evaluationLatencyMs: 15,
          isColdStart: false,
        };
      },
      checkHealth: async () => ({ isAvailable: true }),
    };

    const service = new CrossEncoderRerankingService(batchTrackingProvider);
    await service.rerankPool(samplePool, { topN: 3 });

    expect(callCount).toBe(1);
    expect(batchSize).toBe(5);
  });

  // 11. Strategy Pattern CrossEncoderEvaluator integration
  it("Scenario 11: CrossEncoderEvaluator integrates with Strategy interface", async () => {
    const strategy = new CrossEncoderEvaluator(mockProvider);
    expect(strategy.name).toBe("Cross-Encoder Reranker");
    const result = await strategy.evaluate(samplePool.query, samplePool.candidateChunks, {
      topN: 2,
    });

    expect(result.evaluatorId).toBe("cross-encoder");
    expect(result.retainedChunks.length).toBe(2);
    expect(result.discardedChunks.length).toBe(3);
    expect(result.retainedChunks[0].decision).toBe("retained");
    expect(result.discardedChunks[0].decision).toBe("discarded");
  });

  // 12. Rank Delta calculation
  it("Scenario 12: accurately calculates rankDelta (originalRank - rerankedRank)", async () => {
    // Original ranks: chunk-1 is 1, chunk-3 is 3
    // Set chunk-3 as highest score so it moves from rank 3 to rank 1 (delta: +2)
    // Set chunk-1 as lowest score so it moves from rank 1 to rank 5 (delta: -4)
    mockProvider.setFixedScores([-10, 0, 15, 5, 2]);
    const result = await rerankingService.rerankPool(samplePool, { topN: 3 });

    const chunk3 = result.candidates.find((c) => c.id === "chunk-3")!;
    expect(chunk3.originalRank).toBe(3);
    expect(chunk3.rerankedRank).toBe(1);
    expect(chunk3.rankDelta).toBe(2); // +2 positions gained

    const chunk1 = result.candidates.find((c) => c.id === "chunk-1")!;
    expect(chunk1.originalRank).toBe(1);
    expect(chunk1.rerankedRank).toBe(5);
    expect(chunk1.rankDelta).toBe(-4); // 4 positions lost
  });
});
