import { describe, it, expect } from "vitest";
import { LayaAdapter } from "@/lib/adapters/laya-adapter";
import { LayaRelevanceFilteringService } from "@/server/services/laya-filtering-service";
import { MockLayaProvider } from "@/lib/providers/mock-laya-provider";
import { Chunk } from "@/lib/types/chunk";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { RAGComparisonOrchestrator } from "@/server/services/rag-comparison-orchestrator";
import { MockCrossEncoderProvider } from "@/lib/providers/mock-cross-encoder-provider";
import { MockLLMProvider } from "@/lib/providers/mock-llm-provider";
import { CrossEncoderRerankingService } from "@/server/services/cross-encoder-reranking-service";

describe("Strict Laya Filtering & Token-Efficiency Experiment", () => {
  const sampleChunks: Chunk[] = [
    {
      id: "chunk-high",
      documentId: "attention.pdf",
      text: "Positional encoding allows Transformer models to account for token order without recurrence.",
      source: "attention.pdf",
      pageNumber: 1,
      decision: "pending",
      relevanceScore: 0.9,
    },
    {
      id: "chunk-mid",
      documentId: "attention.pdf",
      text: "The Transformer uses multi-head attention to attend to information from different representation subspaces.",
      source: "attention.pdf",
      pageNumber: 2,
      decision: "pending",
      relevanceScore: 0.7,
    },
    {
      id: "chunk-low",
      documentId: "attention.pdf",
      text: "Models were trained with the Adam optimizer using beta1 0.9 and beta2 0.98.",
      source: "attention.pdf",
      pageNumber: 3,
      decision: "pending",
      relevanceScore: 0.5,
    },
    {
      id: "chunk-irrel",
      documentId: "handbook.pdf",
      text: "The cafeteria is closed on weekends and company holidays.",
      source: "handbook.pdf",
      pageNumber: 4,
      decision: "pending",
      relevanceScore: 0.1,
    },
  ];

  function createProbabilisticMockProvider() {
    const provider = new MockLayaProvider();
    // Configure specific keep probabilities
    const probMap: Record<string, { decision: "keep" | "drop"; keepProb: number }> = {
      "chunk-high": { decision: "keep", keepProb: 0.92 },
      "chunk-mid": { decision: "keep", keepProb: 0.74 },
      "chunk-low": { decision: "keep", keepProb: 0.58 },
      "chunk-irrel": { decision: "drop", keepProb: 0.15 },
    };

    provider.evaluateRelevance = async (_query, candidates) => {
      return {
        decisions: candidates.map((c) => {
          const cfg = probMap[c.id] || { decision: "drop" as const, keepProb: 0.1 };
          return {
            chunkId: c.id,
            decision: cfg.decision,
            keepProbability: cfg.keepProb,
            dropProbability: 1 - cfg.keepProb,
            confidence: 0.5,
            answerConfidence: Math.max(cfg.keepProb, 1 - cfg.keepProb),
          };
        }),
        evaluationLatencyMs: 12,
        modelLoadLatencyMs: 0,
        isColdStart: false,
        model: "mock-modernbert-probabilistic",
      };
    };

    return provider;
  }

  // =========================================================================
  // 1. CONFIGURATION & VALIDATION
  // =========================================================================
  describe("Configuration & Threshold Validation", () => {
    it("should accept valid threshold values in [0.0, 1.0]", async () => {
      const adapter = new LayaAdapter(createProbabilisticMockProvider());
      const res0 = await adapter.filterCandidates("query", sampleChunks, { threshold: 0.0 });
      expect(res0.filteringThreshold).toBe(0.0);

      const resHalf = await adapter.filterCandidates("query", sampleChunks, { threshold: 0.5 });
      expect(resHalf.filteringThreshold).toBe(0.5);

      const res1 = await adapter.filterCandidates("query", sampleChunks, { threshold: 1.0 });
      expect(res1.filteringThreshold).toBe(1.0);
    });

    it("should reject negative thresholds with a clear error", async () => {
      const adapter = new LayaAdapter(createProbabilisticMockProvider());
      await expect(
        adapter.filterCandidates("query", sampleChunks, { threshold: -0.05 })
      ).rejects.toThrow(/Invalid Laya filtering threshold: -0.05/);
    });

    it("should reject thresholds greater than 1.0 with a clear error", async () => {
      const adapter = new LayaAdapter(createProbabilisticMockProvider());
      await expect(
        adapter.filterCandidates("query", sampleChunks, { threshold: 1.25 })
      ).rejects.toThrow(/Invalid Laya filtering threshold: 1.25/);
    });

    it("should reject NaN thresholds with a clear error", async () => {
      const adapter = new LayaAdapter(createProbabilisticMockProvider());
      await expect(
        adapter.filterCandidates("query", sampleChunks, { threshold: NaN })
      ).rejects.toThrow(/Invalid Laya filtering threshold: NaN/);
    });
  });

  // =========================================================================
  // 2. BASELINE BEHAVIOR INVARIANCE
  // =========================================================================
  describe("Baseline Default Invariance", () => {
    it("should preserve default KEEP/DROP behavior when threshold is undefined", async () => {
      const adapter = new LayaAdapter(createProbabilisticMockProvider());
      const result = await adapter.filterCandidates("query", sampleChunks);

      // All 3 chunks with decision='keep' (0.92, 0.74, 0.58) should be retained
      expect(result.retainedChunks).toHaveLength(3);
      expect(result.retainedChunks.map((c) => c.id)).toEqual([
        "chunk-high",
        "chunk-mid",
        "chunk-low",
      ]);
      expect(result.discardedChunks).toHaveLength(1);
      expect(result.discardedChunks[0].id).toBe("chunk-irrel");
      expect(result.filteringThreshold).toBeUndefined();
    });

    it("should produce identical retained set when threshold is 0.50 as undefined", async () => {
      const adapter = new LayaAdapter(createProbabilisticMockProvider());
      const defaultRes = await adapter.filterCandidates("query", sampleChunks);
      const threshold50Res = await adapter.filterCandidates("query", sampleChunks, {
        threshold: 0.5,
      });

      expect(defaultRes.retainedChunks.map((c) => c.id)).toEqual(
        threshold50Res.retainedChunks.map((c) => c.id)
      );
      expect(threshold50Res.filteringThreshold).toBe(0.5);
    });
  });

  // =========================================================================
  // 3. STRICT FILTERING GATING LOGIC
  // =========================================================================
  describe("Strict Gating Logic", () => {
    it("should prune chunks with keepProbability below strict threshold", async () => {
      const adapter = new LayaAdapter(createProbabilisticMockProvider());

      // At threshold 0.70: chunk-low (0.58) should be pruned
      const res70 = await adapter.filterCandidates("query", sampleChunks, { threshold: 0.7 });
      expect(res70.retainedChunks.map((c) => c.id)).toEqual(["chunk-high", "chunk-mid"]);
      expect(res70.discardedChunks.map((c) => c.id)).toEqual(["chunk-low", "chunk-irrel"]);

      // At threshold 0.85: chunk-mid (0.74) and chunk-low (0.58) should be pruned
      const res85 = await adapter.filterCandidates("query", sampleChunks, { threshold: 0.85 });
      expect(res85.retainedChunks.map((c) => c.id)).toEqual(["chunk-high"]);
      expect(res85.discardedChunks.map((c) => c.id)).toEqual([
        "chunk-mid",
        "chunk-low",
        "chunk-irrel",
      ]);
    });

    it("should propagate filteringThreshold through LayaRelevanceFilteringService into LayaFilteredPool", async () => {
      const service = new LayaRelevanceFilteringService(createProbabilisticMockProvider());
      const pool: CandidateChunkPool = {
        id: "test_pool",
        query: "What is positional encoding?",
        retrievedAt: Date.now(),
        candidateChunks: sampleChunks,
        totalCandidates: sampleChunks.length,
        retrievalConfig: { topK: 4, embeddingModel: "test" },
        embeddingModel: "test",
        retrievalLatencyMs: 0,
      };

      const filteredPool = await service.filterPool(pool, { threshold: 0.75 });
      expect(filteredPool.filteringThreshold).toBe(0.75);
      expect(filteredPool.retainedCandidates).toHaveLength(1);
      expect(filteredPool.retainedCandidates[0].id).toBe("chunk-high");
      expect(filteredPool.contextReductionPercent).toBe(75); // 3 of 4 pruned
    });
  });

  // =========================================================================
  // 4. DOWNSTREAM PROMPT TOKEN ECONOMY & ORCHESTRATION
  // =========================================================================
  describe("Downstream Prompt Token Economy", () => {
    it("should reduce prompt token volume when strict threshold prunes candidates", async () => {
      const mockLLM = new MockLLMProvider();
      const mockCE = new CrossEncoderRerankingService(new MockCrossEncoderProvider());
      const mockLayaService = new LayaRelevanceFilteringService(createProbabilisticMockProvider());

      const orchestrator = new RAGComparisonOrchestrator({
        crossEncoderService: mockCE,
        layaService: mockLayaService,
        llmProvider: mockLLM,
      });

      const pool: CandidateChunkPool = {
        id: "token_pool",
        query: "Transformer positional encodings",
        retrievedAt: Date.now(),
        candidateChunks: sampleChunks,
        totalCandidates: sampleChunks.length,
        retrievalConfig: { topK: 4, embeddingModel: "test" },
        embeddingModel: "test",
        retrievalLatencyMs: 0,
      };

      // Run baseline (threshold=undefined)
      const resBaseline = await orchestrator.compareCandidatePool(pool, { mode: "native" });
      // Run strict (threshold=0.85)
      const resStrict = await orchestrator.compareCandidatePool(pool, {
        mode: "native",
        layaThreshold: 0.85,
      });

      // Cross-Encoder is completely unchanged between both runs
      expect(resBaseline.crossEncoder.selectedChunkIds).toEqual(
        resStrict.crossEncoder.selectedChunkIds
      );
      expect(resBaseline.crossEncoder.promptTokens).toBe(
        resStrict.crossEncoder.promptTokens
      );

      // Strict Laya retains fewer chunks than baseline Laya
      expect(resStrict.laya.retainedCount).toBeLessThan(resBaseline.laya.retainedCount);
      expect(resStrict.laya.selectedChunkIds).toEqual(["chunk-high"]);

      // Strict Laya context and prompt tokens are strictly lower than baseline Laya
      expect(resStrict.laya.contextCharacterCount).toBeLessThan(
        resBaseline.laya.contextCharacterCount
      );
      expect(resStrict.laya.promptTokens).toBeLessThan(resBaseline.laya.promptTokens);
      expect(resStrict.laya.filteringThreshold).toBe(0.85);
      expect(resStrict.laya.strategyName).toContain("strict τ=0.85");
    });
  });

  // =========================================================================
  // 5. EVALUATION MODE INDEPENDENCE (Mode A vs Mode B)
  // =========================================================================
  describe("Mode Independence (Native vs Context-Budget)", () => {
    it("should maintain clear distinction between native strict filtering and context-budget mode", async () => {
      const mockLLM = new MockLLMProvider();
      const mockCE = new CrossEncoderRerankingService(new MockCrossEncoderProvider());
      const mockLayaService = new LayaRelevanceFilteringService(createProbabilisticMockProvider());

      const orchestrator = new RAGComparisonOrchestrator({
        crossEncoderService: mockCE,
        layaService: mockLayaService,
        llmProvider: mockLLM,
      });

      const pool: CandidateChunkPool = {
        id: "mode_pool",
        query: "Explain Transformer architecture",
        retrievedAt: Date.now(),
        candidateChunks: sampleChunks,
        totalCandidates: sampleChunks.length,
        retrievalConfig: { topK: 4, embeddingModel: "test" },
        embeddingModel: "test",
        retrievalLatencyMs: 0,
      };

      // Mode A: Native mode with strict threshold
      const nativeStrict = await orchestrator.compareCandidatePool(pool, {
        mode: "native",
        layaThreshold: 0.7,
      });
      expect(nativeStrict.mode).toBe("native");
      expect(nativeStrict.laya.filteringThreshold).toBe(0.7);

      // Mode B: Controlled Context-Budget mode
      const budgetRun = await orchestrator.compareCandidatePool(pool, {
        mode: "context-budget",
        maxContextChunks: 2,
      });
      expect(budgetRun.mode).toBe("context-budget");
      expect(budgetRun.crossEncoder.selectedChunks.length).toBeLessThanOrEqual(2);
      expect(budgetRun.laya.selectedChunks.length).toBeLessThanOrEqual(2);
    });
  });

  // =========================================================================
  // 6. BOUNDARY CONDITIONS & PROBABILITY SAFETY HARDENING
  // =========================================================================
  describe("Boundary Conditions & Safe Probability Handling", () => {
    it("should discard candidate at 0.7499 and retain candidate at 0.7500 when threshold is 0.75", async () => {
      const provider = new MockLayaProvider();
      provider.evaluateRelevance = async () => ({
        decisions: [
          {
            chunkId: "chunk-boundary-low",
            decision: "keep",
            keepProbability: 0.7499,
            dropProbability: 0.2501,
          },
          {
            chunkId: "chunk-boundary-exact",
            decision: "keep",
            keepProbability: 0.75,
            dropProbability: 0.25,
          },
        ],
        evaluationLatencyMs: 10,
        isColdStart: false,
        model: "mock-model",
      });

      const adapter = new LayaAdapter(provider);
      const testChunks: Chunk[] = [
        { id: "chunk-boundary-low", documentId: "doc1", text: "Text A" },
        { id: "chunk-boundary-exact", documentId: "doc1", text: "Text B" },
      ];

      const res = await adapter.filterCandidates("query", testChunks, { threshold: 0.75 });
      expect(res.retainedChunks.map((c) => c.id)).toEqual(["chunk-boundary-exact"]);
      expect(res.discardedChunks.map((c) => c.id)).toEqual(["chunk-boundary-low"]);

      expect(res.retainedChunks[0].relevanceRationale).toContain("retained: P(keep)=0.7500 >= 0.75");
      expect(res.discardedChunks[0].relevanceRationale).toContain("dropped: P(keep)=0.7499 < 0.75");
    });

    it("should NEVER retain candidate if decision is 'drop', even if keepProbability >= threshold", async () => {
      const provider = new MockLayaProvider();
      provider.evaluateRelevance = async () => ({
        decisions: [
          {
            chunkId: "chunk-drop-high-prob",
            decision: "drop",
            keepProbability: 0.95,
            dropProbability: 0.05,
          },
        ],
        evaluationLatencyMs: 10,
        isColdStart: false,
        model: "mock-model",
      });

      const adapter = new LayaAdapter(provider);
      const testChunks: Chunk[] = [
        { id: "chunk-drop-high-prob", documentId: "doc1", text: "Text C" },
      ];

      const res = await adapter.filterCandidates("query", testChunks, { threshold: 0.75 });
      expect(res.retainedChunks).toHaveLength(0);
      expect(res.discardedChunks).toHaveLength(1);
      expect(res.discardedChunks[0].relevanceRationale).toContain(
        "dropped: laya decision was drop (P(keep)=0.9500)"
      );
    });

    it("should safely drop candidate if keepProbability is missing/null/undefined when threshold is active", async () => {
      const provider = new MockLayaProvider();
      provider.evaluateRelevance = async () => ({
        decisions: [
          {
            chunkId: "chunk-missing-prob",
            decision: "keep",
            keepProbability: undefined,
          },
          {
            chunkId: "chunk-nan-prob",
            decision: "keep",
            keepProbability: NaN,
          },
        ],
        evaluationLatencyMs: 10,
        isColdStart: false,
        model: "mock-model",
      });

      const adapter = new LayaAdapter(provider);
      const testChunks: Chunk[] = [
        { id: "chunk-missing-prob", documentId: "doc1", text: "Text D" },
        { id: "chunk-nan-prob", documentId: "doc1", text: "Text E" },
      ];

      const res = await adapter.filterCandidates("query", testChunks, { threshold: 0.75 });
      // Missing probability must NOT be assumed as 1.0! It must be dropped.
      expect(res.retainedChunks).toHaveLength(0);
      expect(res.discardedChunks).toHaveLength(2);
      expect(res.discardedChunks[0].relevanceRationale).toContain(
        "dropped: missing or invalid keepProbability in strict mode (threshold=0.75)"
      );
    });

    it("should allow baseline retention when keepProbability is missing and threshold is undefined", async () => {
      const provider = new MockLayaProvider();
      provider.evaluateRelevance = async () => ({
        decisions: [
          {
            chunkId: "chunk-baseline-no-prob",
            decision: "keep",
            keepProbability: undefined,
          },
        ],
        evaluationLatencyMs: 10,
        isColdStart: false,
        model: "mock-model",
      });

      const adapter = new LayaAdapter(provider);
      const testChunks: Chunk[] = [
        { id: "chunk-baseline-no-prob", documentId: "doc1", text: "Text F" },
      ];

      const res = await adapter.filterCandidates("query", testChunks);
      expect(res.retainedChunks).toHaveLength(1);
      expect(res.retainedChunks[0].id).toBe("chunk-baseline-no-prob");
      expect(res.retainedChunks[0].relevanceRationale).toBe("retained: laya decision was keep");
    });
  });

  // =========================================================================
  // 7. API ROUTE (/api/compare) THRESHOLD PROPAGATION
  // =========================================================================
  describe("API Route (/api/compare) Threshold Propagation", () => {
    it("should correctly receive and propagate layaThreshold via POST /api/compare in JSON mode", async () => {
      const { POST } = await import("@/app/api/compare/route");
      const { NextRequest } = await import("next/server");
      const { vi } = await import("vitest");

      const spy = vi
        .spyOn(RAGComparisonOrchestrator.prototype, "compareCandidatePool")
        .mockResolvedValueOnce({
          id: "comp_test",
          query: "What are the standard working hours?",
          timestamp: Date.now(),
          mode: "native",
          topN: 5,
          sharedRetrieval: {
            candidateCount: sampleChunks.length,
            retrievalLatencyMs: 5,
            candidatePool: {
              id: "pool_1",
              query: "What are the standard working hours?",
              retrievedAt: Date.now(),
              candidateChunks: sampleChunks,
              totalCandidates: sampleChunks.length,
              retrievalConfig: { topK: 4, embeddingModel: "test" },
              embeddingModel: "test",
              retrievalLatencyMs: 0,
            },
          },
          crossEncoder: {
            pipelineId: "advanced-rag",
            strategyName: "Cross-Encoder",
            strategyId: "cross-encoder",
            selectedChunkIds: ["chunk-high"],
            selectedChunks: [sampleChunks[0]],
            retainedCount: 1,
            discardedCount: 3,
            contextText: "ctx",
            contextCharacterCount: 3,
            contextTokenCount: 1,
            isTokenCountEstimated: false,
            relevanceLatencyMs: 10,
            contextBuildLatencyMs: 2,
            generationLatencyMs: 50,
            totalLatencyMs: 62,
            answer: "answer A",
            promptTokens: 100,
            completionTokens: 20,
            totalTokens: 120,
          },
          laya: {
            pipelineId: "laya-rag",
            strategyName: "Laya Relevance Filter (strict τ=0.75)",
            strategyId: "laya",
            selectedChunkIds: ["chunk-high"],
            selectedChunks: [sampleChunks[0]],
            retainedCount: 1,
            discardedCount: 3,
            contextText: "ctx",
            contextCharacterCount: 3,
            contextTokenCount: 1,
            isTokenCountEstimated: false,
            relevanceLatencyMs: 10,
            contextBuildLatencyMs: 2,
            generationLatencyMs: 50,
            totalLatencyMs: 62,
            answer: "answer B",
            promptTokens: 100,
            completionTokens: 20,
            totalTokens: 120,
            filteringThreshold: 0.75,
          },
          overallLatencyMs: 100,
          trace: [],
          llmModel: "llama3.2:3b",
          llmProvider: "ollama",
          generationParameters: {},
        });

      const pool: CandidateChunkPool = {
        id: "api_test_pool",
        query: "What are the standard working hours?",
        retrievedAt: Date.now(),
        candidateChunks: sampleChunks,
        totalCandidates: sampleChunks.length,
        retrievalConfig: { topK: 4, embeddingModel: "test" },
        embeddingModel: "test",
        retrievalLatencyMs: 0,
      };

      const request = new NextRequest("http://localhost:3000/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: pool.query,
          candidatePool: pool,
          mode: "native",
          layaThreshold: 0.75,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify that orchestrator received layaThreshold: 0.75
      expect(spy).toHaveBeenCalledTimes(1);
      const callArgs = spy.mock.calls[0];
      expect(callArgs[1]?.layaThreshold).toBe(0.75);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.result.laya.filteringThreshold).toBe(0.75);

      spy.mockRestore();
    });

    it("should correctly receive and propagate layaThreshold via POST /api/compare in SSE streaming mode", async () => {
      const { POST } = await import("@/app/api/compare/route");
      const { NextRequest } = await import("next/server");
      const { vi } = await import("vitest");

      const spy = vi
        .spyOn(RAGComparisonOrchestrator.prototype, "compareCandidatePool")
        .mockResolvedValueOnce({
          id: "comp_test_sse",
          query: "What are the standard working hours?",
          timestamp: Date.now(),
          mode: "native",
          topN: 5,
          sharedRetrieval: {
            candidateCount: sampleChunks.length,
            retrievalLatencyMs: 5,
            candidatePool: {
              id: "pool_1",
              query: "What are the standard working hours?",
              retrievedAt: Date.now(),
              candidateChunks: sampleChunks,
              totalCandidates: sampleChunks.length,
              retrievalConfig: { topK: 4, embeddingModel: "test" },
              embeddingModel: "test",
              retrievalLatencyMs: 0,
            },
          },
          crossEncoder: {
            pipelineId: "advanced-rag",
            strategyName: "Cross-Encoder",
            strategyId: "cross-encoder",
            selectedChunkIds: ["chunk-high"],
            selectedChunks: [sampleChunks[0]],
            retainedCount: 1,
            discardedCount: 3,
            contextText: "ctx",
            contextCharacterCount: 3,
            contextTokenCount: 1,
            isTokenCountEstimated: false,
            relevanceLatencyMs: 10,
            contextBuildLatencyMs: 2,
            generationLatencyMs: 50,
            totalLatencyMs: 62,
            answer: "answer A",
            promptTokens: 100,
            completionTokens: 20,
            totalTokens: 120,
          },
          laya: {
            pipelineId: "laya-rag",
            strategyName: "Laya Relevance Filter (strict τ=0.75)",
            strategyId: "laya",
            selectedChunkIds: ["chunk-high"],
            selectedChunks: [sampleChunks[0]],
            retainedCount: 1,
            discardedCount: 3,
            contextText: "ctx",
            contextCharacterCount: 3,
            contextTokenCount: 1,
            isTokenCountEstimated: false,
            relevanceLatencyMs: 10,
            contextBuildLatencyMs: 2,
            generationLatencyMs: 50,
            totalLatencyMs: 62,
            answer: "answer B",
            promptTokens: 100,
            completionTokens: 20,
            totalTokens: 120,
            filteringThreshold: 0.75,
          },
          overallLatencyMs: 100,
          trace: [],
          llmModel: "llama3.2:3b",
          llmProvider: "ollama",
          generationParameters: {},
        });

      const pool: CandidateChunkPool = {
        id: "api_test_pool_sse",
        query: "What are the standard working hours?",
        retrievedAt: Date.now(),
        candidateChunks: sampleChunks,
        totalCandidates: sampleChunks.length,
        retrievalConfig: { topK: 4, embeddingModel: "test" },
        embeddingModel: "test",
        retrievalLatencyMs: 0,
      };

      const request = new NextRequest("http://localhost:3000/api/compare?stream=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          query: pool.query,
          candidatePool: pool,
          mode: "native",
          layaThreshold: 0.75,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/event-stream");

      expect(spy).toHaveBeenCalledTimes(1);
      const callArgs = spy.mock.calls[0];
      expect(callArgs[1]?.layaThreshold).toBe(0.75);

      spy.mockRestore();
    });
  });
});
