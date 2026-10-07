import { describe, it, expect, beforeEach } from "vitest";
import { RAGComparisonOrchestrator } from "../server/services/rag-comparison-orchestrator";
import { CrossEncoderRerankingService } from "../server/services/cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "../server/services/laya-filtering-service";
import { MockCrossEncoderProvider } from "../lib/providers/mock-cross-encoder-provider";
import { MockLayaProvider } from "../lib/providers/mock-laya-provider";
import { MockLLMProvider } from "../lib/providers/mock-llm-provider";
import { CandidateChunkPool } from "../lib/types/candidate-pool";
import { Chunk } from "../lib/types/chunk";

describe("Phase 5 — Controlled Cross-Encoder vs Laya Comparison Benchmark", () => {
  let mockCrossEncoder: MockCrossEncoderProvider;
  let mockLaya: MockLayaProvider;
  let mockLLM: MockLLMProvider;
  let crossEncoderService: CrossEncoderRerankingService;
  let layaService: LayaRelevanceFilteringService;
  let orchestrator: RAGComparisonOrchestrator;

  const sampleChunks: Chunk[] = [
    {
      id: "chunk-1",
      documentId: "doc-attention",
      text: "FlashAttention reduces memory I/O by tiling computation across GPU SRAM.",
      source: "attention_mechanisms.pdf",
      pageNumber: 3,
      retrievalScore: 0.91,
      rank: 1,
    },
    {
      id: "chunk-2",
      documentId: "doc-attention",
      text: "Linear attention replaces softmax with kernel feature maps.",
      source: "attention_mechanisms.pdf",
      pageNumber: 5,
      retrievalScore: 0.88,
      rank: 2,
    },
    {
      id: "chunk-3",
      documentId: "doc-attention",
      text: "Coffee beans are roasted at temperatures between 200 and 230 degrees Celsius.",
      source: "irrelevant_cooking.pdf",
      pageNumber: 1,
      retrievalScore: 0.72,
      rank: 3,
    },
    {
      id: "chunk-4",
      documentId: "doc-attention",
      text: "Multi-Query Attention shares key and value heads across all query heads.",
      source: "attention_mechanisms.pdf",
      pageNumber: 7,
      retrievalScore: 0.69,
      rank: 4,
    },
    {
      id: "chunk-5",
      documentId: "doc-attention",
      text: "The capital of France is Paris.",
      source: "geography.pdf",
      pageNumber: 2,
      retrievalScore: 0.55,
      rank: 5,
    },
  ];

  const samplePool: CandidateChunkPool = {
    id: "pool-comp-test",
    query: "What mechanisms optimize transformer attention memory complexity?",
    candidateChunks: sampleChunks,
    totalCandidates: 5,
    retrievalConfig: { topK: 5, embeddingModel: "nomic-embed-text" },
    retrievalLatencyMs: 38,
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

  // --------------------------------------------------------------------------
  // Test 1 — Same Candidate Pool
  // --------------------------------------------------------------------------
  it("Test 1: guarantees both branches receive exactly the same candidate chunks and metadata", async () => {
    mockCrossEncoder.setFixedScores([2.5, 1.8, -1.2, 0.9, -2.1]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "keep", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool, {
      mode: "native",
      topN: 3,
    });

    // Verification of shared retrieval lineage
    expect(result.sharedRetrieval.candidateCount).toBe(5);
    expect(result.sharedRetrieval.candidatePool.id).toBe("pool-comp-test");

    // Both strategies evaluated the original 5 candidates
    expect(result.crossEncoder.discardedCount + result.crossEncoder.retainedCount).toBe(5);
    expect(result.laya.discardedCount + result.laya.retainedCount).toBe(5);
  });

  // --------------------------------------------------------------------------
  // Test 2 — Same Query
  // --------------------------------------------------------------------------
  it("Test 2: verifies the exact same query reaches both relevance strategies and the LLM", async () => {
    mockCrossEncoder.setFixedScores([2.0, 1.0, 0.5, -0.5, -1.0]);
    mockLaya.setFixedDecisions(["keep", "drop", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool);

    expect(result.query).toBe(samplePool.query);
    expect(mockLLM.callHistory.length).toBe(2);
    expect(mockLLM.callHistory[0].prompt.userQuery).toBe(samplePool.query);
    expect(mockLLM.callHistory[1].prompt.userQuery).toBe(samplePool.query);
  });

  // --------------------------------------------------------------------------
  // Test 3 — Same LLM
  // --------------------------------------------------------------------------
  it("Test 3: verifies both paths invoke the exact same LLM provider and model", async () => {
    mockCrossEncoder.setFixedScores([1.0, 2.0, 0.0, -1.0, -2.0]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool);

    expect(result.llmModel).toBe(mockLLM.model);
    expect(result.llmProvider).toBe(mockLLM.id);
    expect(mockLLM.callHistory.length).toBe(2);
    expect(mockLLM.callHistory[0].prompt.systemInstruction).toBe(
      mockLLM.callHistory[1].prompt.systemInstruction
    );
  });

  // --------------------------------------------------------------------------
  // Test 4 — Same Generation Prompt
  // --------------------------------------------------------------------------
  it("Test 4: verifies the generation prompt template and system instructions are identical", async () => {
    mockCrossEncoder.setFixedScores([3.0, 2.0, 1.0, 0.0, -1.0]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "drop", "drop"]);

    await orchestrator.compareCandidatePool(samplePool);

    const callA = mockLLM.callHistory[0];
    const callB = mockLLM.callHistory[1];

    expect(callA.prompt.systemInstruction).toBe(callB.prompt.systemInstruction);
    expect(callA.prompt.systemInstruction).toContain("factual, concise question-answering assistant");
    expect(callA.prompt.systemInstruction).toContain("strictly using the provided context passages");
  });

  // --------------------------------------------------------------------------
  // Test 5 — Context Construction
  // --------------------------------------------------------------------------
  it("Test 5: verifies selected chunks are formatted into context with identical headers and boundaries", async () => {
    mockCrossEncoder.setFixedScores([3.0, 2.0, 1.0, 0.0, -1.0]);
    mockLaya.setFixedDecisions(["keep", "drop", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool, { topN: 1 });

    const contextA = result.crossEncoder.contextText;
    const contextB = result.laya.contextText;

    // Both should contain the standard passage header format
    expect(contextA).toContain("[Passage 1] | Source: attention_mechanisms.pdf | Page: 3 | Chunk: chunk-1");
    expect(contextB).toContain("[Passage 1] | Source: attention_mechanisms.pdf | Page: 3 | Chunk: chunk-1");
    expect(contextA).toContain("FlashAttention reduces memory I/O");
    expect(contextB).toContain("FlashAttention reduces memory I/O");
  });

  // --------------------------------------------------------------------------
  // Test 6 — Native Strategy Mode
  // --------------------------------------------------------------------------
  it("Test 6: verifies native mode allows Cross-Encoder Top-N and Laya all-KEEP behavior", async () => {
    // Cross-Encoder topN = 3
    mockCrossEncoder.setFixedScores([2.0, 1.5, 0.8, -0.5, -1.5]);
    // Laya keeps 2
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool, {
      mode: "native",
      topN: 3,
    });

    expect(result.mode).toBe("native");
    expect(result.crossEncoder.retainedCount).toBe(3);
    expect(result.laya.retainedCount).toBe(2);
    expect(result.crossEncoder.selectedChunkIds.length).toBe(3);
    expect(result.laya.selectedChunkIds.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Test 7 — Context-Budget Mode
  // --------------------------------------------------------------------------
  it("Test 7: verifies context-budget mode enforces maxContextChunks on both paths", async () => {
    mockCrossEncoder.setFixedScores([3.0, 2.5, 2.0, 1.5, 1.0]);
    // Laya marks 4 as KEEP
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "keep", "keep"]);

    const result = await orchestrator.compareCandidatePool(samplePool, {
      mode: "context-budget",
      topN: 5,
      maxContextChunks: 2,
    });

    expect(result.mode).toBe("context-budget");
    expect(result.maxContextChunks).toBe(2);
    expect(result.crossEncoder.retainedCount).toBe(2);
    expect(result.laya.retainedCount).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Test 8 — Laya Over Budget Deterministic Policy
  // --------------------------------------------------------------------------
  it("Test 8: verifies Laya over-budget policy preserves original retrieval order deterministically", async () => {
    // Candidates: chunk-1 (rank 1), chunk-2 (rank 2), chunk-4 (rank 4) are KEEP
    mockCrossEncoder.setFixedScores([1.0, 1.0, 1.0, 1.0, 1.0]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "keep", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool, {
      mode: "context-budget",
      maxContextChunks: 2,
    });

    // Should take the first 2 KEEP candidates in original retrieval order: chunk-1 and chunk-2
    expect(result.laya.retainedCount).toBe(2);
    expect(result.laya.selectedChunkIds).toEqual(["chunk-1", "chunk-2"]);
    expect(result.laya.selectedChunkIds).not.toContain("chunk-4");
  });

  // --------------------------------------------------------------------------
  // Test 9 — Empty Laya Context Handling
  // --------------------------------------------------------------------------
  it("Test 9: verifies empty Laya context does NOT fall back to unrelated chunks and generates answer with empty context prompt", async () => {
    mockCrossEncoder.setFixedScores([2.0, 1.0, 0.0, -1.0, -2.0]);
    // Laya drops ALL candidates
    mockLaya.setFixedDecisions(["drop", "drop", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool, {
      mode: "native",
    });

    expect(result.laya.retainedCount).toBe(0);
    expect(result.laya.selectedChunkIds.length).toBe(0);
    expect(result.laya.contextCharacterCount).toBe(0);
    expect(result.laya.contextTokenCount).toBe(0);

    // Call 1 (Cross-Encoder) had context, Call 2 (Laya) had empty context
    const layaLLMCall = mockLLM.callHistory[1];
    expect(layaLLMCall.prompt.contextText).toBe("");
    expect(result.laya.answer).toContain("The provided context does not contain sufficient information");
  });

  // --------------------------------------------------------------------------
  // Test 10 — Token Metrics Propagation
  // --------------------------------------------------------------------------
  it("Test 10: verifies token counts (prompt, completion, total) are accurately captured", async () => {
    mockCrossEncoder.setFixedScores([2.0, 1.0, 0.0, -1.0, -2.0]);
    mockLaya.setFixedDecisions(["keep", "drop", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool);

    expect(result.crossEncoder.promptTokens).toBeGreaterThan(0);
    expect(result.crossEncoder.completionTokens).toBeGreaterThan(0);
    expect(result.crossEncoder.totalTokens).toBe(
      result.crossEncoder.promptTokens + result.crossEncoder.completionTokens
    );

    expect(result.laya.promptTokens).toBeGreaterThan(0);
    expect(result.laya.completionTokens).toBeGreaterThan(0);
    expect(result.laya.totalTokens).toBe(
      result.laya.promptTokens + result.laya.completionTokens
    );
  });

  // --------------------------------------------------------------------------
  // Test 11 — Latency Breakdown Metrics
  // --------------------------------------------------------------------------
  it("Test 11: verifies independent stage-level latencies are recorded for both paths", async () => {
    mockCrossEncoder.setFixedScores([2.0, 1.0, 0.0, -1.0, -2.0]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool);

    // Path A timing
    expect(result.crossEncoder.relevanceLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.crossEncoder.contextBuildLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.crossEncoder.generationLatencyMs).toBeGreaterThan(0);
    expect(result.crossEncoder.totalLatencyMs).toBeGreaterThan(0);

    // Path B timing
    expect(result.laya.relevanceLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.laya.contextBuildLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.laya.generationLatencyMs).toBeGreaterThan(0);
    expect(result.laya.totalLatencyMs).toBeGreaterThan(0);

    // Overall wall-clock
    expect(result.overallLatencyMs).toBeGreaterThanOrEqual(0);
  });

  // --------------------------------------------------------------------------
  // Test 12 — Provider Failure Handling
  // --------------------------------------------------------------------------
  it("Test 12: handles downstream LLM failure gracefully and records structured error", async () => {
    mockCrossEncoder.setFixedScores([2.0, 1.0, 0.0, -1.0, -2.0]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "drop", "drop"]);

    mockLLM.setSimulateError(true, "Ollama service unavailable");

    const result = await orchestrator.compareCandidatePool(samplePool);

    expect(result.crossEncoder.error).toContain("Ollama service unavailable");
    expect(result.laya.error).toContain("Ollama service unavailable");
    expect(result.crossEncoder.answer).toContain("Generation failed for this branch");
    expect(result.laya.answer).toContain("Generation failed for this branch");
  });

  // --------------------------------------------------------------------------
  // Test 13 — No Independent Retrieval
  // --------------------------------------------------------------------------
  it("Test 13: verifies orchestrator never performs independent secondary retrieval", async () => {
    mockCrossEncoder.setFixedScores([2.0, 1.0, 0.0, -1.0, -2.0]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "drop", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool);

    // Retrieval latency in result is directly sourced from initial candidate pool
    expect(result.sharedRetrieval.retrievalLatencyMs).toBe(samplePool.retrievalLatencyMs);
    expect(result.sharedRetrieval.candidateCount).toBe(samplePool.candidateChunks.length);
  });

  // --------------------------------------------------------------------------
  // Test 14 — Identical Generation Parameters
  // --------------------------------------------------------------------------
  it("Test 14: verifies both paths receive identical generation parameters (temperature, seed)", async () => {
    mockCrossEncoder.setFixedScores([2.0, 1.0, 0.0, -1.0, -2.0]);
    mockLaya.setFixedDecisions(["keep", "keep", "drop", "drop", "drop"]);

    await orchestrator.compareCandidatePool(samplePool, {
      generationOptions: { temperature: 0, seed: 12345 },
    });

    const callA = mockLLM.callHistory[0];
    const callB = mockLLM.callHistory[1];

    expect(callA.options?.temperature).toBe(0);
    expect(callB.options?.temperature).toBe(0);
    expect(callA.options?.seed).toBe(12345);
    expect(callB.options?.seed).toBe(12345);
  });

  // --------------------------------------------------------------------------
  // Test 15 — Answer Isolation
  // --------------------------------------------------------------------------
  it("Test 15: verifies each answer is generated using only its corresponding selected context", async () => {
    // Cross-Encoder selects chunk-1 and chunk-2
    mockCrossEncoder.setFixedScores([3.0, 2.0, -1.0, -1.0, -1.0]);
    // Laya selects chunk-4
    mockLaya.setFixedDecisions(["drop", "drop", "drop", "keep", "drop"]);

    const result = await orchestrator.compareCandidatePool(samplePool, {
      mode: "native",
      topN: 2,
    });

    const callA = mockLLM.callHistory[0];
    const callB = mockLLM.callHistory[1];

    // Context A has FlashAttention and Linear attention
    expect(callA.prompt.contextText).toContain("FlashAttention");
    expect(callA.prompt.contextText).toContain("Linear attention");
    expect(callA.prompt.contextText).not.toContain("Multi-Query Attention");

    // Context B has Multi-Query Attention
    expect(callB.prompt.contextText).toContain("Multi-Query Attention");
    expect(callB.prompt.contextText).not.toContain("FlashAttention");
    expect(callB.prompt.contextText).not.toContain("Linear attention");

    // Results reflect isolated context IDs
    expect(result.crossEncoder.selectedChunkIds).toEqual(["chunk-1", "chunk-2"]);
    expect(result.laya.selectedChunkIds).toEqual(["chunk-4"]);
  });

  // --------------------------------------------------------------------------
  // Edge Case: Invalid or Empty Pool
  // --------------------------------------------------------------------------
  it("throws an error when candidate pool is missing or empty", async () => {
    await expect(
      orchestrator.compareCandidatePool(null as unknown as CandidateChunkPool)
    ).rejects.toThrow();

    const emptyPool: CandidateChunkPool = {
      id: "empty",
      query: "",
      candidateChunks: [],
      totalCandidates: 0,
      retrievalConfig: { topK: 0, embeddingModel: "mock" },
      retrievalLatencyMs: 0,
      embeddingModel: "mock",
      retrievedAt: Date.now(),
    };

    await expect(orchestrator.compareCandidatePool(emptyPool)).rejects.toThrow();
  });
});
