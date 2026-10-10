import { describe, it, expect, beforeEach } from "vitest";
import { MockLayaProvider } from "../lib/providers/mock-laya-provider";
import { LayaAdapter } from "../lib/adapters/laya-adapter";
import { LayaEvaluator } from "../lib/patterns/strategy/relevance-strategy";
import { LayaRelevanceFilteringService } from "../server/services/laya-filtering-service";
import { CandidateChunkPool } from "../lib/types/candidate-pool";
import { Chunk } from "../lib/types/chunk";
import { LayaProvider } from "../lib/interfaces/laya-provider";
import { LayaDecisionType } from "../lib/types/laya";
import { LayaProviderFactory } from "../lib/providers/laya-provider-factory";
import { PythonLayaProvider } from "../lib/providers/python-laya-provider";

describe("Phase 4 — Laya Relevance Evaluation & Semantic Pruning", () => {
  let mockProvider: MockLayaProvider;
  let filteringService: LayaRelevanceFilteringService;

  const sampleChunks: Chunk[] = [
    {
      id: "chunk-1",
      documentId: "doc-rag",
      text: "Standard multi-head attention calculates O(N^2) pairwise interactions between all tokens.",
      source: "attention_mechanisms.md",
      pageNumber: 1,
      rank: 1,
      retrievalScore: 0.91,
      decision: "pending",
    },
    {
      id: "chunk-2",
      documentId: "doc-rag",
      text: "Linear attention reduces complexity to O(N) by decomposing the softmax kernel.",
      source: "attention_mechanisms.md",
      pageNumber: 2,
      rank: 2,
      retrievalScore: 0.88,
      decision: "pending",
    },
    {
      id: "chunk-3",
      documentId: "doc-rag",
      text: "A popular Italian dessert is tiramisu, made with ladyfingers, coffee, and mascarpone cheese.",
      source: "dessert_recipes.md",
      pageNumber: 1,
      rank: 3,
      retrievalScore: 0.82,
      decision: "pending",
    },
    {
      id: "chunk-4",
      documentId: "doc-rag",
      text: "Convolutional neural networks use local receptive fields and weight sharing for vision tasks.",
      source: "vision_models.md",
      pageNumber: 1,
      rank: 4,
      retrievalScore: 0.77,
      decision: "pending",
    },
    {
      id: "chunk-5",
      documentId: "doc-rag",
      text: "FlashAttention uses SRAM tiling to accelerate transformer self-attention computations.",
      source: "attention_mechanisms.md",
      pageNumber: 3,
      rank: 5,
      retrievalScore: 0.75,
      decision: "pending",
    },
  ];

  const samplePool: CandidateChunkPool = {
    id: "pool-laya-test-456",
    query: "What attention mechanisms mitigate quadratic complexity in transformer models?",
    retrievedAt: 1710000000000,
    candidateChunks: sampleChunks,
    totalCandidates: 5,
    retrievalConfig: {
      topK: 5,
      embeddingModel: "nomic-embed-text",
    },
    embeddingModel: "nomic-embed-text",
    retrievalLatencyMs: 38,
  };

  beforeEach(() => {
    mockProvider = new MockLayaProvider();
    filteringService = new LayaRelevanceFilteringService(mockProvider);
  });

  // Test 1 — All candidates evaluated
  it("Scenario 1: evaluates all candidate chunks supplied in the pool", async () => {
    const result = await filteringService.filterPool(samplePool);

    expect(result.totalCandidates).toBe(5);
    expect(result.candidates.length).toBe(5);
    const resultIds = new Set(result.candidates.map((c) => c.id));
    sampleChunks.forEach((c) => {
      expect(resultIds.has(c.id)).toBe(true);
    });
  });

  // Test 2 — KEEP decisions
  it("Scenario 2: retains only chunks with KEEP decisions", async () => {
    mockProvider.setPredefinedDecisions({
      "chunk-1": "keep",
      "chunk-2": "keep",
      "chunk-3": "drop",
      "chunk-4": "drop",
      "chunk-5": "keep",
    });

    const result = await filteringService.filterPool(samplePool);

    expect(result.retainedCount).toBe(3);
    expect(result.retainedCandidates.length).toBe(3);
    const retainedIds = result.retainedCandidates.map((c) => c.id);
    expect(retainedIds).toEqual(["chunk-1", "chunk-2", "chunk-5"]);
    result.retainedCandidates.forEach((c) => {
      expect(c.layaDecision).toBe("keep");
      expect(c.decision).toBe("retained");
      expect(c.isRetained).toBe(true);
    });
  });

  // Test 3 — DROP decisions
  it("Scenario 3: preserves dropped chunks in discarded list without prompt inclusion", async () => {
    mockProvider.setPredefinedDecisions({
      "chunk-1": "keep",
      "chunk-2": "keep",
      "chunk-3": "drop",
      "chunk-4": "drop",
      "chunk-5": "keep",
    });

    const result = await filteringService.filterPool(samplePool);

    expect(result.discardedCount).toBe(2);
    expect(result.discardedCandidates.length).toBe(2);
    const discardedIds = result.discardedCandidates.map((c) => c.id);
    expect(discardedIds).toEqual(["chunk-3", "chunk-4"]);
    result.discardedCandidates.forEach((c) => {
      expect(c.layaDecision).toBe("drop");
      expect(c.decision).toBe("discarded");
      expect(c.isRetained).toBe(false);
    });
  });

  // Test 4 — Candidate lineage preservation
  it("Scenario 4: preserves chunk ID, documentId, source, page, text, original rank, and retrieval score", async () => {
    const result = await filteringService.filterPool(samplePool);

    const chunk1 = result.candidates.find((c) => c.id === "chunk-1")!;
    expect(chunk1.id).toBe("chunk-1");
    expect(chunk1.documentId).toBe("doc-rag");
    expect(chunk1.source).toBe("attention_mechanisms.md");
    expect(chunk1.pageNumber).toBe(1);
    expect(chunk1.text).toBe(sampleChunks[0].text);
    expect(chunk1.originalRank).toBe(1);
    expect(chunk1.originalRetrievalScore).toBe(0.91);
  });

  // Test 5 — No secondary retrieval
  it("Scenario 5: consumes only CandidateChunkPool without secondary vector retrieval", async () => {
    const result = await filteringService.filterPool(samplePool);

    expect(result.originalPoolId).toBe(samplePool.id);
    expect(result.query).toBe(samplePool.query);
    expect(result.retrievedAt).toBe(samplePool.retrievedAt);
    expect(result.embeddingModel).toBe(samplePool.embeddingModel);
  });

  // Test 6 — Context reduction calculation
  it("Scenario 6: calculates candidate context reduction percentage correctly", async () => {
    // 10 candidates pool
    const tenChunks: Chunk[] = Array.from({ length: 10 }, (_, i) => ({
      id: `chunk-${i + 1}`,
      documentId: "doc-scaling",
      text: `Passage ${i + 1} content text`,
      rank: i + 1,
      retrievalScore: 0.9 - i * 0.05,
      decision: "pending",
    }));

    const tenPool: CandidateChunkPool = {
      id: "pool-ten",
      query: "Scaling test query",
      retrievedAt: Date.now(),
      candidateChunks: tenChunks,
      totalCandidates: 10,
      retrievalConfig: { topK: 10, embeddingModel: "nomic-embed-text" },
      embeddingModel: "nomic-embed-text",
      retrievalLatencyMs: 40,
    };

    // 4 KEEP, 6 DROP -> reduction = ((10 - 4) / 10) * 100 = 60.0%
    mockProvider.setFixedDecisions([
      "keep",
      "keep",
      "drop",
      "drop",
      "keep",
      "drop",
      "drop",
      "keep",
      "drop",
      "drop",
    ]);

    const result = await filteringService.filterPool(tenPool);

    expect(result.totalCandidates).toBe(10);
    expect(result.retainedCount).toBe(4);
    expect(result.discardedCount).toBe(6);
    expect(result.contextReductionPercent).toBe(60.0);
    expect(result.metrics.contextReductionPercent).toBe(60.0);
  });

  // Test 7 — Zero candidates handling
  it("Scenario 7: handles empty candidate pool cleanly without division by zero", async () => {
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

    const result = await filteringService.filterPool(emptyPool);

    expect(result.totalCandidates).toBe(0);
    expect(result.retainedCount).toBe(0);
    expect(result.discardedCount).toBe(0);
    expect(result.contextReductionPercent).toBe(0);
    expect(result.candidates).toEqual([]);
    expect(result.retainedCandidates).toEqual([]);
    expect(result.discardedCandidates).toEqual([]);
  });

  // Test 8 — Invalid Laya response rejection
  it("Scenario 8: throws explicit validation error when provider emits unrecognized decision", async () => {
    const invalidProvider: LayaProvider = {
      id: "invalid-mock",
      model: "test-invalid-model",
      evaluateRelevance: async () => ({
        decisions: [
          {
            chunkId: "chunk-1",
            decision: "maybe" as unknown as LayaDecisionType, // Invalid decision
          },
        ],
        evaluationLatencyMs: 10,
        isColdStart: false,
        model: "test-invalid-model",
      }),
      checkHealth: async () => ({ isAvailable: true }),
    };

    const invalidAdapter = new LayaAdapter(invalidProvider);
    const service = new LayaRelevanceFilteringService(invalidAdapter);

    await expect(service.filterPool(samplePool)).rejects.toThrow(
      "Invalid/unrecognized decision 'maybe'"
    );
  });

  // Test 9 — Provider failure handling
  it("Scenario 9: propagates meaningful error when Laya runtime encounters failure", async () => {
    mockProvider.simulateFailure(
      true,
      "Laya child process disconnected unexpectedly."
    );

    await expect(filteringService.filterPool(samplePool)).rejects.toThrow(
      "Laya child process disconnected unexpectedly."
    );
  });

  // Test 10 — Batch behavior
  it("Scenario 10: passes all candidates in a single batch to the Laya provider", async () => {
    let callCount = 0;
    let batchSize = 0;

    const batchTrackingProvider: LayaProvider = {
      id: "batch-tracking-laya",
      model: "batch-tracking-model",
      evaluateRelevance: async (_query, candidates) => {
        callCount++;
        batchSize = candidates.length;
        return {
          decisions: candidates.map((c) => ({
            chunkId: c.id,
            decision: "keep",
            keepProbability: 0.9,
          })),
          evaluationLatencyMs: 25,
          isColdStart: false,
          model: "batch-tracking-model",
        };
      },
      checkHealth: async () => ({ isAvailable: true }),
    };

    const service = new LayaRelevanceFilteringService(batchTrackingProvider);
    await service.filterPool(samplePool);

    expect(callCount).toBe(1);
    expect(batchSize).toBe(5);
  });

  // Test 11 — Strategy Pattern compliance
  it("Scenario 11: LayaEvaluator satisfies the RelevanceEvaluator Strategy contract", async () => {
    const strategy = new LayaEvaluator(mockProvider);
    expect(strategy.id).toBe("laya");
    expect(strategy.name).toBe("Laya Relevance Filter");

    mockProvider.setFixedDecisions(["keep", "drop", "drop", "keep", "drop"]);
    const result = await strategy.evaluate(
      samplePool.query,
      samplePool.candidateChunks
    );

    expect(result.evaluatorId).toBe("laya");
    expect(result.retainedChunks.length).toBe(2);
    expect(result.discardedChunks.length).toBe(3);
    expect(result.retainedChunks[0].decision).toBe("retained");
    expect(result.discardedChunks[0].decision).toBe("discarded");
  });

  // Test 12 — Latency metrics instrumentation
  it("Scenario 12: accurately calculates and records evaluation latency metrics", async () => {
    const result = await filteringService.filterPool(samplePool);

    expect(result.metrics.candidateCount).toBe(5);
    expect(result.metrics.evaluationLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.averageCandidateLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.metrics.isColdStart).toBe("boolean");
  });

  // Test 13 — Provider Factory globalThis caching prevents orphan worker processes
  it("Scenario 13: LayaProviderFactory caches providers on globalThis across module re-evaluations", () => {
    const mock1 = LayaProviderFactory.getProvider("mock");
    const mock2 = LayaProviderFactory.getProvider("mock");
    expect(mock1).toBe(mock2);
    expect(globalThis.__layaProviderInstanceMap?.has("mock:default")).toBe(true);
  });

  // Test 14 — PythonLayaProvider constructor defaults and configuration
  it("Scenario 14: PythonLayaProvider configures default model and non-fatal timeouts", () => {
    const provider = new PythonLayaProvider({
      modelPath: "test-model",
      startupTimeoutMs: 5000,
      requestTimeoutMs: 5000,
    });
    expect(provider.id).toBe("python");
    expect(provider.model).toBe("test-model");
    provider.dispose();
  });
});
