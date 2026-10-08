import { describe, it, expect } from "vitest";
import { BenchmarkDatasetService } from "../server/services/benchmark-dataset-service";
import { BenchmarkEvaluator } from "../server/services/benchmark-evaluator";
import { BenchmarkRunnerService } from "../server/services/benchmark-runner-service";
import { RAGComparisonOrchestrator } from "../server/services/rag-comparison-orchestrator";
import { CrossEncoderRerankingService } from "../server/services/cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "../server/services/laya-filtering-service";
import { MockCrossEncoderProvider } from "../lib/providers/mock-cross-encoder-provider";
import { MockLayaProvider } from "../lib/providers/mock-laya-provider";
import { MockLLMProvider } from "../lib/providers/mock-llm-provider";
import { generateBenchmarkCsv } from "../lib/utils/benchmark-export";

describe("Phase 6: Objective Benchmark & Evaluation Suite", () => {
  // =========================================================================
  // 1. DATASET INTEGRITY & SCHEMA VALIDATION TESTS
  // =========================================================================
  describe("Benchmark Dataset Invariants", () => {
    it("should load a valid non-empty benchmark dataset with >= 30 cases", () => {
      const dataset = BenchmarkDatasetService.loadDataset();
      expect(dataset.length).toBeGreaterThanOrEqual(30);
      expect(dataset.length).toBe(36);
    });

    it("should enforce unique benchmark case IDs across the dataset", () => {
      const dataset = BenchmarkDatasetService.loadDataset();
      const ids = dataset.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should cover all 9 required benchmark categories", () => {
      const summary = BenchmarkDatasetService.getSummary();
      const requiredCategories = [
        "NORMAL",
        "DISTRACTOR_HEAVY",
        "MULTI_CHUNK",
        "AMBIGUOUS",
        "PARTIAL_CONTEXT",
        "NO_ANSWER",
        "SINGLE_RELEVANT",
        "CONFLICTING_CONTEXT",
        "LONG_CONTEXT",
      ];

      for (const cat of requiredCategories) {
        expect(summary.categories[cat as keyof typeof summary.categories]).toBeGreaterThan(0);
      }
    });

    it("should ensure every candidate chunk in a case has valid non-empty text and metadata", () => {
      const dataset = BenchmarkDatasetService.loadDataset();
      for (const c of dataset) {
        expect(c.candidateChunks.length).toBeGreaterThan(0);
        for (const chunk of c.candidateChunks) {
          expect(chunk.id).toBeDefined();
          expect(chunk.text.length).toBeGreaterThan(10);
          expect(chunk.source).toBeDefined();
          expect(chunk.pageNumber).toBeGreaterThanOrEqual(1);
          expect(chunk.decision).toBe("pending");
        }
      }
    });

    it("should guarantee ground-truth relevantChunkIds exist within the case candidate pool", () => {
      const dataset = BenchmarkDatasetService.loadDataset();
      for (const c of dataset) {
        const candidateIds = new Set(c.candidateChunks.map((chunk) => chunk.id));
        for (const relId of c.relevantChunkIds) {
          expect(candidateIds.has(relId)).toBe(true);
        }
      }
    });

    it("should maintain strict consistency for unanswerable (NO_ANSWER) benchmark cases", () => {
      const dataset = BenchmarkDatasetService.loadDataset();
      const noAnswerCases = dataset.filter((c) => c.category === "NO_ANSWER");
      expect(noAnswerCases.length).toBeGreaterThanOrEqual(4);

      for (const c of noAnswerCases) {
        expect(c.answerable).toBe(false);
        const refLower = c.referenceAnswer.toLowerCase();
        expect(refLower.includes("not contain") || refLower.includes("contains no")).toBe(true);
      }
    });
  });

  // =========================================================================
  // 2. RELEVANCE & CONTEXT METRICS TESTS
  // =========================================================================
  describe("Relevance & Context Efficiency Metrics", () => {
    it("should compute precision, recall, and F1 accurately for partial relevance", () => {
      // 2 relevant ground truth chunks: c1, c2
      // Strategy selected: c1, c3 (1 relevant, 1 irrelevant)
      const metrics = BenchmarkEvaluator.evaluateRelevance(["c1", "c3"], ["c1", "c2"]);
      expect(metrics.precision).toBe(0.5); // 1 / 2
      expect(metrics.recall).toBe(0.5); // 1 / 2
      expect(metrics.f1).toBe(0.5); // 2 * 0.5 * 0.5 / (0.5 + 0.5)
      expect(metrics.hitRate).toBe(1);
    });

    it("should compute perfect 1.0 precision, recall, and F1 on complete match", () => {
      const metrics = BenchmarkEvaluator.evaluateRelevance(
        ["c1", "c2"],
        ["c1", "c2"]
      );
      expect(metrics.precision).toBe(1.0);
      expect(metrics.recall).toBe(1.0);
      expect(metrics.f1).toBe(1.0);
      expect(metrics.hitRate).toBe(1);
    });

    it("should handle 0 relevant chunks selected (recall = 0, f1 = 0, hitRate = 0)", () => {
      const metrics = BenchmarkEvaluator.evaluateRelevance(["c3", "c4"], ["c1", "c2"]);
      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });

    it("should compute MRR and NDCG for ranking strategies, and flag as N/A for binary filtering", () => {
      // Cross-Encoder: ranking strategy where first relevant chunk is at index 1 (rank 2)
      const rankingMetrics = BenchmarkEvaluator.evaluateRelevance(
        ["c-distractor", "c-rel1", "c-rel2"],
        ["c-rel1", "c-rel2"],
        true,
        ["c-distractor", "c-rel1", "c-rel2"]
      );
      expect(rankingMetrics.isRankingMetricApplicable).toBe(true);
      expect(rankingMetrics.mrr).toBe(0.5); // 1 / 2
      expect(rankingMetrics.ndcg).toBeGreaterThan(0);

      // Laya: binary filtering strategy where MRR is not fabricated
      const binaryMetrics = BenchmarkEvaluator.evaluateRelevance(
        ["c-rel1", "c-rel2"],
        ["c-rel1", "c-rel2"],
        false
      );
      expect(binaryMetrics.isRankingMetricApplicable).toBe(false);
      expect(binaryMetrics.mrr).toBeNull();
      expect(binaryMetrics.ndcg).toBeNull();
    });

    it("should calculate context and token reduction percentages without mixing character and token metrics", () => {
      const eff = BenchmarkEvaluator.evaluateContextEfficiency(
        10, // initial count
        3,  // retained count
        4000, // initial chars
        1200, // retained chars
        1000, // initial tokens
        300   // retained tokens
      );

      expect(eff.initialCandidateCount).toBe(10);
      expect(eff.retainedCount).toBe(3);
      expect(eff.retentionRate).toBe(0.3);
      expect(eff.contextReductionPercent).toBe(70.0);
      expect(eff.characterReductionPercent).toBe(70.0);
      expect(eff.tokenReductionPercent).toBe(70.0);
      expect(eff.initialContextCharacters).toBe(4000);
      expect(eff.initialContextTokens).toBe(1000);
    });
  });

  // =========================================================================
  // 3. ANSWER QUALITY & GROUNDEDNESS TESTS
  // =========================================================================
  describe("Answer Quality & Groundedness Checks", () => {
    it("should evaluate exact match and lexical similarity correctly", () => {
      const ans1 = BenchmarkEvaluator.evaluateAnswerQuality(
        "Linear attention reduces complexity to O(N).",
        "Linear attention reduces complexity to O(N).",
        true,
        ["linear attention", "o(n)"]
      );
      expect(ans1.exactMatch).toBe(true);
      expect(ans1.referenceAnswerSimilarity).toBe(1.0);
      expect(ans1.factCoverage).toBe(1.0);
    });

    it("should measure fact and keyword coverage objectively", () => {
      const ans = BenchmarkEvaluator.evaluateAnswerQuality(
        "The model uses masked language modeling to learn representations.",
        "BERT uses masked language modeling and next sentence prediction.",
        true,
        ["masked language modeling", "next sentence prediction"]
      );
      expect(ans.factCoverage).toBe(0.5); // 1 of 2 required facts found
    });

    it("should verify noAnswerCompliance for unanswerable queries", () => {
      // Good refusal
      const goodRefusal = BenchmarkEvaluator.evaluateAnswerQuality(
        "Based on the provided context, the answer cannot be determined because there is insufficient information.",
        "The provided context does not contain information.",
        false
      );
      expect(goodRefusal.noAnswerCompliance).toBe(true);

      // Hallucinated answer with no refusal
      const badAnswer = BenchmarkEvaluator.evaluateAnswerQuality(
        "The first cat in space was named Felicette and she returned on October 18, 1963.",
        "The provided context does not contain information.",
        false
      );
      expect(badAnswer.noAnswerCompliance).toBe(false);
    });

    it("should verify deterministic faithfulness against selected context", () => {
      const context = "Linear attention approximations replace the quadratic matrix with kernel maps, reducing complexity from O(N^2) to O(N).";
      const faithfulAnswer = "Linear attention reduces complexity to O(N) by replacing the matrix with kernel maps.";
      const unfaithfulAnswer = "Quantum convolutional neural networks execute adiabatic annealing on superconducting qubits.";

      const faithfulEval = BenchmarkEvaluator.evaluateAnswerQuality(
        faithfulAnswer,
        "Linear attention achieves O(N).",
        true,
        [],
        context
      );
      const unfaithfulEval = BenchmarkEvaluator.evaluateAnswerQuality(
        unfaithfulAnswer,
        "Linear attention achieves O(N).",
        true,
        [],
        context
      );

      expect(faithfulEval.faithfulnessScore).toBeGreaterThan(0.7);
      expect(unfaithfulEval.faithfulnessScore).toBeLessThan(0.3);
    });
  });

  // =========================================================================
  // 4. STATISTICAL AGGREGATION & PAIRED DIFFERENCES TESTS
  // =========================================================================
  describe("Statistical Aggregates & Pareto Analysis", () => {
    it("should compute mean, median, min, max, and stdDev accurately", () => {
      const values = [10, 20, 30, 40, 50];
      const agg = BenchmarkEvaluator.computeAggregate(values);
      expect(agg.count).toBe(5);
      expect(agg.mean).toBe(30);
      expect(agg.median).toBe(30);
      expect(agg.min).toBe(10);
      expect(agg.max).toBe(50);
      expect(agg.stdDev).toBeCloseTo(14.1421, 2);
    });

    it("should compute paired comparisons with correct superior counts and ties", () => {
      const ceF1 = [0.8, 0.4, 0.9, 0.7];
      const layaF1 = [0.8, 0.6, 0.5, 0.7];

      const paired = BenchmarkEvaluator.computePairedComparison(
        "F1",
        ceF1,
        layaF1,
        true // higher is better
      );

      expect(paired.totalComparisons).toBe(4);
      expect(paired.tieCount).toBe(2); // index 0 (0.8 vs 0.8), index 3 (0.7 vs 0.7)
      expect(paired.ceBetterCount).toBe(1); // index 2 (0.9 > 0.5)
      expect(paired.layaBetterCount).toBe(1); // index 1 (0.6 > 0.4)
    });

    it("should perform multi-attribute Pareto tradeoff analysis without single winner scoring", () => {
      // Case 1: CE is faster (relevance latency 10 vs 200), but Laya has higher F1 (0.9 vs 0.4) -> TRADEOFF
      const ceF1 = [0.4];
      const layaF1 = [0.9];
      const ceCoverage = [1.0];
      const layaCoverage = [1.0];
      const ceContextRed = [10];
      const layaContextRed = [60];
      const ceRelLatency = [10];
      const layaRelLatency = [200];
      const ceTotLatency = [500];
      const layaTotLatency = [700];

      const pareto = BenchmarkEvaluator.computeParetoAnalysis(
        ceF1,
        layaF1,
        ceCoverage,
        layaCoverage,
        ceContextRed,
        layaContextRed,
        ceRelLatency,
        layaRelLatency,
        ceTotLatency,
        layaTotLatency
      );

      expect(pareto.tradeoffCount).toBe(1);
      expect(pareto.ceDominatesLayaCount).toBe(0);
      expect(pareto.layaDominatesCeCount).toBe(0);
      expect(pareto.summary).toContain("Pareto tradeoffs");
    });
  });

  // =========================================================================
  // 5. FAILURE ANALYSIS CLASSIFICATION TESTS
  // =========================================================================
  describe("Failure Classification Logic", () => {
    it("should classify BOTH_CORRECT when both strategies select exact relevant chunks", () => {
      const res = BenchmarkEvaluator.classifyFailures(
        ["c1", "c2"],
        ["c1", "c2"],
        ["c1", "c2"],
        true
      );
      expect(res.classification).toBe("BOTH_CORRECT");
      expect(res.crossEncoderFailures).toHaveLength(0);
      expect(res.layaFailures).toHaveLength(0);
    });

    it("should classify CROSS_ENCODER_FALSE_POSITIVE when CE retains extra distractors", () => {
      const res = BenchmarkEvaluator.classifyFailures(
        ["c1"],
        ["c1", "c2", "c3"], // CE retained 2 distractors
        ["c1"],             // Laya kept only relevant
        true
      );
      expect(res.classification).toBe("CROSS_ENCODER_FALSE_POSITIVE");
      expect(res.crossEncoderFailures).toContain("RETAIN_IRRELEVANT_c2");
      expect(res.layaFailures).toHaveLength(0);
    });

    it("should classify LAYA_FALSE_NEGATIVE when Laya drops a relevant passage", () => {
      const res = BenchmarkEvaluator.classifyFailures(
        ["c1", "c2"],
        ["c1", "c2"],       // CE kept both
        ["c1"],             // Laya missed c2
        true
      );
      expect(res.classification).toBe("LAYA_FALSE_NEGATIVE");
      expect(res.layaFailures).toContain("MISS_RELEVANT_c2");
    });
  });

  // =========================================================================
  // 6. BENCHMARK RUNNER CONTROLS & REPRODUCIBILITY TESTS
  // =========================================================================
  describe("Benchmark Runner & Scientific Controls", () => {
    it("should execute benchmark runner under strict mock controls producing complete BenchmarkSuiteResult", async () => {
      const mockCE = new CrossEncoderRerankingService(new MockCrossEncoderProvider());
      const mockLayaService = new LayaRelevanceFilteringService(new MockLayaProvider());
      const mockLLM = new MockLLMProvider();

      const orchestrator = new RAGComparisonOrchestrator({
        crossEncoderService: mockCE,
        layaService: mockLayaService,
        llmProvider: mockLLM,
      });

      const runner = new BenchmarkRunnerService(orchestrator);

      // Run a subset of 3 cases
      const dataset = BenchmarkDatasetService.loadDataset();
      const testCases = dataset.slice(0, 3).map((c) => c.id);

      const suiteResult = await runner.runBenchmark({
        mode: "native",
        caseIds: testCases,
      });

      expect(suiteResult.caseCount).toBe(3);
      expect(suiteResult.completedCount).toBe(3);
      expect(suiteResult.failureCount).toBe(0);
      expect(suiteResult.queryResults).toHaveLength(3);

      // Verify metadata
      expect(suiteResult.metadata.mode).toBe("native");
      expect(suiteResult.metadata.datasetVersion).toBe("1.0.0");
      expect(suiteResult.metadata.llmModel).toBe(mockLLM.model);

      // Verify aggregates exist
      expect(suiteResult.crossEncoderAggregates.f1).toBeDefined();
      expect(suiteResult.layaAggregates.f1).toBeDefined();
      expect(suiteResult.pairedComparisons.f1).toBeDefined();
      expect(suiteResult.paretoAnalysis).toBeDefined();
    });

    it("should support context-budget mode in benchmark runner", async () => {
      const mockCE = new CrossEncoderRerankingService(new MockCrossEncoderProvider());
      const mockLayaService = new LayaRelevanceFilteringService(new MockLayaProvider());
      const mockLLM = new MockLLMProvider();

      const orchestrator = new RAGComparisonOrchestrator({
        crossEncoderService: mockCE,
        layaService: mockLayaService,
        llmProvider: mockLLM,
      });

      const runner = new BenchmarkRunnerService(orchestrator);
      const dataset = BenchmarkDatasetService.loadDataset();

      const suiteResult = await runner.runBenchmark({
        mode: "context-budget",
        contextBudget: 2,
        caseIds: [dataset[0].id],
      });

      expect(suiteResult.metadata.mode).toBe("context-budget");
      expect(suiteResult.metadata.contextBudget).toBe(2);
      expect(suiteResult.queryResults[0].crossEncoder.contextMetrics.retainedCount).toBeLessThanOrEqual(2);
    });
  });

  // =========================================================================
  // 6. PHASE 7: DASHBOARD ANALYSIS REFINEMENTS & METRIC AUDITS
  // =========================================================================
  describe("Phase 7: Dashboard Analysis Refinements & Metric Audits", () => {
    it("should synthesize context-grounded mock answers reflecting retained passages", async () => {
      const mockLLM = new MockLLMProvider();
      const result = await mockLLM.generateAnswer({
        systemInstruction: "You are a factual assistant.",
        contextText: "[Passage 1]\nFlashAttention reduces memory I/O by tiling computation across GPU SRAM.",
        userQuery: "How does FlashAttention optimize GPU memory?",
      });

      expect(result.answerText).toContain("FlashAttention reduces memory I/O by tiling computation");
      expect(result.answerText).toContain("Based strictly on the provided context passages");
    });

    it("should audit and verify fact coverage and lexical groundedness calculations", () => {
      const answer = "FlashAttention eliminates HBM memory bottlenecks by tiling matrix operations directly inside SRAM.";
      const reference = "FlashAttention reduces memory I/O by tiling computation across SRAM.";
      const context = "FlashAttention eliminates HBM memory bottlenecks by tiling matrix operations directly inside SRAM.";

      const evalResult = BenchmarkEvaluator.evaluateAnswerQuality(
        answer,
        reference,
        true,
        ["flashattention", "tiling", "sram"],
        context
      );

      // All 3 facts covered
      expect(evalResult.factCoverage).toBe(1.0);
      expect(evalResult.lexicalGroundednessScore).toBeDefined();
      expect(evalResult.lexicalGroundednessScore).toBeGreaterThan(0.7);
      expect(evalResult.lexicalGroundednessScore).toBe(evalResult.faithfulnessScore);
    });

    it("should support multi-token required facts matching", () => {
      const answer = "The architecture uses grouped query attention and shared key value heads.";
      const evalResult = BenchmarkEvaluator.evaluateAnswerQuality(
        answer,
        "It uses grouped query attention.",
        true,
        ["grouped query attention", "key value heads"]
      );

      expect(evalResult.factCoverage).toBe(1.0);
    });

    it("should include candidate chunk decisions in query benchmark results", async () => {
      const mockCE = new CrossEncoderRerankingService(new MockCrossEncoderProvider());
      const mockLayaService = new LayaRelevanceFilteringService(new MockLayaProvider());
      const mockLLM = new MockLLMProvider();

      const orchestrator = new RAGComparisonOrchestrator({
        crossEncoderService: mockCE,
        layaService: mockLayaService,
        llmProvider: mockLLM,
      });

      const runner = new BenchmarkRunnerService(orchestrator);
      const dataset = BenchmarkDatasetService.loadDataset();

      const suiteResult = await runner.runBenchmark({
        mode: "native",
        caseIds: [dataset[0].id],
      });

      const queryResult = suiteResult.queryResults[0];
      expect(queryResult.candidateDecisions).toBeDefined();
      expect(queryResult.candidateDecisions!.length).toBe(dataset[0].candidateChunks.length);

      const firstDecision = queryResult.candidateDecisions![0];
      expect(firstDecision.id).toBeDefined();
      expect(firstDecision.crossEncoder).toBeDefined();
      expect(firstDecision.laya).toBeDefined();
      expect(["keep", "drop"]).toContain(firstDecision.laya.decision);
      expect(typeof firstDecision.isGroundTruthRelevant).toBe("boolean");
    });

    it("should export benchmark results to properly formatted CSV", async () => {
      const mockCE = new CrossEncoderRerankingService(new MockCrossEncoderProvider());
      const mockLayaService = new LayaRelevanceFilteringService(new MockLayaProvider());
      const mockLLM = new MockLLMProvider();

      const orchestrator = new RAGComparisonOrchestrator({
        crossEncoderService: mockCE,
        layaService: mockLayaService,
        llmProvider: mockLLM,
      });

      const runner = new BenchmarkRunnerService(orchestrator);
      const dataset = BenchmarkDatasetService.loadDataset();

      const suiteResult = await runner.runBenchmark({
        mode: "native",
        caseIds: [dataset[0].id],
      });

      const csv = generateBenchmarkCsv(suiteResult);
      expect(csv).toContain("QueryID,Category,Query,Answerable");
      expect(csv).toContain("CE_F1,Laya_F1");
      expect(csv).toContain("CE_LexicalGroundedness,Laya_LexicalGroundedness");
      expect(csv).toContain(dataset[0].id);
    });
  });
});
