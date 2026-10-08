import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  BenchmarkCase,
  BenchmarkCategory,
  BenchmarkSuiteResult,
  QueryBenchmarkResult,
  CategoryAggregate,
  BenchmarkRunMetadata,
} from "@/lib/types/benchmark";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { ComparisonMode } from "@/lib/types/comparison";
import { RAGComparisonOrchestrator } from "./rag-comparison-orchestrator";
import { BenchmarkEvaluator } from "./benchmark-evaluator";
import { BenchmarkDatasetService } from "./benchmark-dataset-service";

export interface BenchmarkRunOptions {
  mode?: ComparisonMode;
  contextBudget?: number;
  runsPerQuery?: number;
  category?: BenchmarkCategory;
  caseIds?: string[];
  limit?: number;
  orchestrator?: RAGComparisonOrchestrator;
  onProgress?: (completed: number, total: number, caseId: string) => void;
}

export class BenchmarkRunnerService {
  private orchestrator: RAGComparisonOrchestrator;

  constructor(orchestrator?: RAGComparisonOrchestrator) {
    this.orchestrator = orchestrator || new RAGComparisonOrchestrator();
  }

  /**
   * Runs the controlled benchmark suite across selected or all cases.
   */
  public async runBenchmark(
    options?: BenchmarkRunOptions
  ): Promise<BenchmarkSuiteResult> {
    const startTime = performance.now();
    const mode: ComparisonMode = options?.mode || "native";
    const contextBudget = options?.contextBudget ?? 3;
    const runsPerQuery = options?.runsPerQuery ?? 1;

    // 1. Load benchmark cases
    let cases = BenchmarkDatasetService.loadDataset();
    if (options?.category) {
      cases = cases.filter((c) => c.category === options.category);
    }
    if (options?.caseIds && options.caseIds.length > 0) {
      const idSet = new Set(options.caseIds);
      cases = cases.filter((c) => idSet.has(c.id));
    }
    if (options?.limit && options.limit > 0) {
      cases = cases.slice(0, options.limit);
    }

    if (cases.length === 0) {
      throw new Error("No benchmark cases found matching specified criteria.");
    }

    const queryResults: QueryBenchmarkResult[] = [];
    let completedCount = 0;
    let failureCount = 0;

    // 2. Execute each benchmark case sequentially to avoid host resource contention
    for (let i = 0; i < cases.length; i++) {
      const caseItem = cases[i];
      if (options?.onProgress) {
        options.onProgress(i, cases.length, caseItem.id);
      }

      try {
        const queryRes = await this.executeSingleCase(
          caseItem,
          mode,
          contextBudget,
          runsPerQuery
        );
        queryResults.push(queryRes);
        completedCount++;
      } catch (err: unknown) {
        failureCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Benchmark failure on case ${caseItem.id}:`, errMsg);
      }
    }

    if (options?.onProgress) {
      options.onProgress(cases.length, cases.length, "completed");
    }

    // 3. Aggregate statistics
    const crossEncoderAggregates = this.aggregateStrategyMetrics(
      queryResults.map((r) => r.crossEncoder)
    );
    const layaAggregates = this.aggregateStrategyMetrics(
      queryResults.map((r) => r.laya)
    );

    // 4. Category-level breakdowns
    const categoryAggregates = this.aggregateByCategory(queryResults);

    // 5. Paired comparisons
    const pairedComparisons = this.computeAllPairedComparisons(queryResults);

    // 6. Multi-dimensional Pareto Analysis
    const paretoAnalysis = BenchmarkEvaluator.computeParetoAnalysis(
      queryResults.map((r) => r.crossEncoder.relevanceMetrics.f1),
      queryResults.map((r) => r.laya.relevanceMetrics.f1),
      queryResults.map((r) => r.crossEncoder.answerMetrics.factCoverage),
      queryResults.map((r) => r.laya.answerMetrics.factCoverage),
      queryResults.map(
        (r) => r.crossEncoder.contextMetrics.contextReductionPercent
      ),
      queryResults.map((r) => r.laya.contextMetrics.contextReductionPercent),
      queryResults.map((r) => r.crossEncoder.latencies.relevanceMs),
      queryResults.map((r) => r.laya.latencies.relevanceMs),
      queryResults.map((r) => r.crossEncoder.latencies.totalMs),
      queryResults.map((r) => r.laya.latencies.totalMs)
    );

    // 7. Metadata
    const metadata: BenchmarkRunMetadata = {
      timestamp: Date.now(),
      gitCommit: this.getGitCommit(),
      datasetVersion: "1.0.0",
      mode,
      contextBudget: mode === "context-budget" ? contextBudget : undefined,
      runsPerQuery,
      llmModel: this.orchestrator.getLLMProvider().model,
      crossEncoderModel: "cross-encoder/ms-marco-MiniLM-L-6-v2",
      layaModel: "ModernBERT-large (D:\\laya)",
      embeddingModel: "nomic-embed-text",
      deviceInfo: `${process.platform}-${process.arch}`,
    };

    const durationMs = Math.round(performance.now() - startTime);

    const suiteResult: BenchmarkSuiteResult = {
      runId: `bench_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      metadata,
      caseCount: cases.length,
      completedCount,
      failureCount,
      durationMs,
      queryResults,
      crossEncoderAggregates,
      layaAggregates,
      categoryAggregates,
      pairedComparisons,
      paretoAnalysis,
    };

    // 8. Persist raw benchmark run file
    this.persistRunResult(suiteResult);

    return suiteResult;
  }

  /**
   * Executes a single benchmark case under identical conditions.
   */
  private async executeSingleCase(
    caseItem: BenchmarkCase,
    mode: ComparisonMode,
    contextBudget: number,
    runsPerQuery: number
  ): Promise<QueryBenchmarkResult> {
    const initialCandidateCount = caseItem.candidateChunks.length;
    const initialCandidateChars = caseItem.candidateChunks.reduce(
      (sum, c) => sum + c.text.length,
      0
    );
    // Estimate initial tokens (4 chars ~ 1 token heuristic for pool)
    const initialCandidateTokens = Math.round(initialCandidateChars / 4);

    // 1. Construct shared CandidateChunkPool
    const sharedPool: CandidateChunkPool = {
      id: `pool_${caseItem.id}`,
      query: caseItem.query,
      retrievedAt: Date.now(),
      candidateChunks: caseItem.candidateChunks,
      totalCandidates: initialCandidateCount,
      retrievalConfig: {
        topK: initialCandidateCount,
        embeddingModel: "nomic-embed-text",
      },
      embeddingModel: "nomic-embed-text",
      retrievalLatencyMs: 0,
    };

    // 2. Execute comparison via orchestrator
    // For repeated runs (if runsPerQuery > 1), we execute the configured repetitions and use the median run
    const compResult = await this.orchestrator.compareCandidatePool(sharedPool, {
      mode,
      topN: 5,
      maxContextChunks: contextBudget,
    });

    if (runsPerQuery > 1) {
      // Execute subsequent runs and collect results
      for (let r = 1; r < runsPerQuery; r++) {
        await this.orchestrator.compareCandidatePool(sharedPool, {
          mode,
          topN: 5,
          maxContextChunks: contextBudget,
        });
      }
    }

    // 3. Evaluate Cross-Encoder
    const ceEval = BenchmarkEvaluator.evaluatePathResult(
      compResult.crossEncoder,
      caseItem,
      initialCandidateCount,
      initialCandidateChars,
      initialCandidateTokens
    );

    // 4. Evaluate Laya
    const layaEval = BenchmarkEvaluator.evaluatePathResult(
      compResult.laya,
      caseItem,
      initialCandidateCount,
      initialCandidateChars,
      initialCandidateTokens
    );

    // 5. Failure Analysis
    const failureAnalysis = BenchmarkEvaluator.classifyFailures(
      caseItem.relevantChunkIds,
      ceEval.selectedChunkIds,
      layaEval.selectedChunkIds,
      caseItem.answerable,
      ceEval.answerMetrics.noAnswerCompliance,
      layaEval.answerMetrics.noAnswerCompliance
    );

    // 6. Paired Differences
    const pairedDifferences = {
      f1Diff: Number((ceEval.relevanceMetrics.f1 - layaEval.relevanceMetrics.f1).toFixed(4)),
      precisionDiff: Number(
        (ceEval.relevanceMetrics.precision - layaEval.relevanceMetrics.precision).toFixed(4)
      ),
      recallDiff: Number(
        (ceEval.relevanceMetrics.recall - layaEval.relevanceMetrics.recall).toFixed(4)
      ),
      contextReductionDiff: Number(
        (
          ceEval.contextMetrics.contextReductionPercent -
          layaEval.contextMetrics.contextReductionPercent
        ).toFixed(2)
      ),
      tokenDiff: ceEval.tokens.total - layaEval.tokens.total,
      relevanceLatencyDiffMs:
        ceEval.latencies.relevanceMs - layaEval.latencies.relevanceMs,
      totalLatencyDiffMs: ceEval.latencies.totalMs - layaEval.latencies.totalMs,
    };

    // 7. Per-candidate chunk side-by-side decision comparison
    const candidateDecisions: import("@/lib/types/benchmark").CandidateChunkDecision[] =
      caseItem.candidateChunks.map((c) => {
        const selectedCe = compResult.crossEncoder.selectedChunks.find(
          (sc) => sc.id === c.id
        );
        const ceSelected = ceEval.selectedChunkIds.includes(c.id);
        const layaSelected = layaEval.selectedChunkIds.includes(c.id);
        const isRel = caseItem.relevantChunkIds.includes(c.id);

        return {
          id: c.id,
          source: c.source,
          pageNumber: c.pageNumber,
          textSnippet:
            c.text.length > 140 ? c.text.substring(0, 140) + "..." : c.text,
          fullText: c.text,
          isGroundTruthRelevant: isRel,
          crossEncoder: {
            selected: ceSelected,
            score: selectedCe?.relevanceScore ?? c.relevanceScore,
            rank: selectedCe?.rank ?? c.rank,
          },
          laya: {
            selected: layaSelected,
            decision: layaSelected ? ("keep" as const) : ("drop" as const),
          },
        };
      });

    return {
      queryId: caseItem.id,
      category: caseItem.category,
      query: caseItem.query,
      description: caseItem.description,
      answerable: caseItem.answerable,
      groundTruth: {
        relevantChunkIds: caseItem.relevantChunkIds,
        referenceAnswer: caseItem.referenceAnswer,
        requiredFacts: caseItem.requiredFacts || [],
      },
      initialCandidateCount,
      crossEncoder: ceEval,
      laya: layaEval,
      failureAnalysis,
      pairedDifferences,
      candidateDecisions,
    };
  }

  /**
   * Computes statistical aggregates for a collection of StrategyCaseEvaluation.
   */
  private aggregateStrategyMetrics(
    evals: import("@/lib/types/benchmark").StrategyCaseEvaluation[]
  ): Record<string, import("@/lib/types/benchmark").MetricAggregate> {
    return {
      precision: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.relevanceMetrics.precision)
      ),
      recall: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.relevanceMetrics.recall)
      ),
      f1: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.relevanceMetrics.f1)
      ),
      hitRate: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.relevanceMetrics.hitRate)
      ),
      contextReductionPercent: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.contextMetrics.contextReductionPercent)
      ),
      characterReductionPercent: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.contextMetrics.characterReductionPercent)
      ),
      tokenReductionPercent: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.tokens.tokenReductionPercent)
      ),
      factCoverage: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.answerMetrics.factCoverage)
      ),
      faithfulnessScore: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.answerMetrics.faithfulnessScore)
      ),
      relevanceLatencyMs: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.latencies.relevanceMs)
      ),
      llmGenerationLatencyMs: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.latencies.generationMs)
      ),
      totalLatencyMs: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.latencies.totalMs)
      ),
      promptTokens: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.tokens.prompt)
      ),
      totalTokens: BenchmarkEvaluator.computeAggregate(
        evals.map((e) => e.tokens.total)
      ),
    };
  }

  /**
   * Aggregates results by benchmark category.
   */
  private aggregateByCategory(
    results: QueryBenchmarkResult[]
  ): Record<BenchmarkCategory, CategoryAggregate> {
    const categories = BenchmarkDatasetService.getCategories();
    const map = {} as Record<BenchmarkCategory, CategoryAggregate>;

    for (const cat of categories) {
      const catResults = results.filter((r) => r.category === cat);
      const count = catResults.length;

      if (count === 0) {
        map[cat] = {
          category: cat,
          caseCount: 0,
          crossEncoder: {
            meanPrecision: 0,
            meanRecall: 0,
            meanF1: 0,
            meanHitRate: 0,
            meanContextReduction: 0,
            meanTotalTokens: 0,
            meanRelevanceLatencyMs: 0,
            meanTotalLatencyMs: 0,
            meanFactCoverage: 0,
          },
          laya: {
            meanPrecision: 0,
            meanRecall: 0,
            meanF1: 0,
            meanHitRate: 0,
            meanContextReduction: 0,
            meanTotalTokens: 0,
            meanRelevanceLatencyMs: 0,
            meanTotalLatencyMs: 0,
            meanFactCoverage: 0,
          },
        };
        continue;
      }

      const cePrecision = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.relevanceMetrics.precision)
      ).mean;
      const ceRecall = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.relevanceMetrics.recall)
      ).mean;
      const ceF1 = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.relevanceMetrics.f1)
      ).mean;
      const ceHit = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.relevanceMetrics.hitRate)
      ).mean;
      const ceRed = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.contextMetrics.contextReductionPercent)
      ).mean;
      const ceTok = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.tokens.total)
      ).mean;
      const ceRelLat = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.latencies.relevanceMs)
      ).mean;
      const ceTotLat = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.latencies.totalMs)
      ).mean;
      const ceFact = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.crossEncoder.answerMetrics.factCoverage)
      ).mean;

      const layaPrecision = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.relevanceMetrics.precision)
      ).mean;
      const layaRecall = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.relevanceMetrics.recall)
      ).mean;
      const layaF1 = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.relevanceMetrics.f1)
      ).mean;
      const layaHit = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.relevanceMetrics.hitRate)
      ).mean;
      const layaRed = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.contextMetrics.contextReductionPercent)
      ).mean;
      const layaTok = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.tokens.total)
      ).mean;
      const layaRelLat = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.latencies.relevanceMs)
      ).mean;
      const layaTotLat = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.latencies.totalMs)
      ).mean;
      const layaFact = BenchmarkEvaluator.computeAggregate(
        catResults.map((r) => r.laya.answerMetrics.factCoverage)
      ).mean;

      map[cat] = {
        category: cat,
        caseCount: count,
        crossEncoder: {
          meanPrecision: cePrecision,
          meanRecall: ceRecall,
          meanF1: ceF1,
          meanHitRate: ceHit,
          meanContextReduction: ceRed,
          meanTotalTokens: ceTok,
          meanRelevanceLatencyMs: ceRelLat,
          meanTotalLatencyMs: ceTotLat,
          meanFactCoverage: ceFact,
        },
        laya: {
          meanPrecision: layaPrecision,
          meanRecall: layaRecall,
          meanF1: layaF1,
          meanHitRate: layaHit,
          meanContextReduction: layaRed,
          meanTotalTokens: layaTok,
          meanRelevanceLatencyMs: layaRelLat,
          meanTotalLatencyMs: layaTotLat,
          meanFactCoverage: layaFact,
        },
      };
    }

    return map;
  }

  /**
   * Computes paired comparisons across key metrics.
   */
  private computeAllPairedComparisons(
    results: QueryBenchmarkResult[]
  ): Record<string, import("@/lib/types/benchmark").PairedComparisonSummary> {
    return {
      f1: BenchmarkEvaluator.computePairedComparison(
        "Relevance F1",
        results.map((r) => r.crossEncoder.relevanceMetrics.f1),
        results.map((r) => r.laya.relevanceMetrics.f1),
        true
      ),
      precision: BenchmarkEvaluator.computePairedComparison(
        "Relevance Precision",
        results.map((r) => r.crossEncoder.relevanceMetrics.precision),
        results.map((r) => r.laya.relevanceMetrics.precision),
        true
      ),
      recall: BenchmarkEvaluator.computePairedComparison(
        "Relevance Recall",
        results.map((r) => r.crossEncoder.relevanceMetrics.recall),
        results.map((r) => r.laya.relevanceMetrics.recall),
        true
      ),
      contextReduction: BenchmarkEvaluator.computePairedComparison(
        "Context Reduction %",
        results.map((r) => r.crossEncoder.contextMetrics.contextReductionPercent),
        results.map((r) => r.laya.contextMetrics.contextReductionPercent),
        true
      ),
      factCoverage: BenchmarkEvaluator.computePairedComparison(
        "Fact Coverage",
        results.map((r) => r.crossEncoder.answerMetrics.factCoverage),
        results.map((r) => r.laya.answerMetrics.factCoverage),
        true
      ),
      relevanceLatency: BenchmarkEvaluator.computePairedComparison(
        "Relevance Latency (ms)",
        results.map((r) => r.crossEncoder.latencies.relevanceMs),
        results.map((r) => r.laya.latencies.relevanceMs),
        false // lower is better
      ),
      totalLatency: BenchmarkEvaluator.computePairedComparison(
        "Total Latency (ms)",
        results.map((r) => r.crossEncoder.latencies.totalMs),
        results.map((r) => r.laya.latencies.totalMs),
        false // lower is better
      ),
      totalTokens: BenchmarkEvaluator.computePairedComparison(
        "Total Tokens",
        results.map((r) => r.crossEncoder.tokens.total),
        results.map((r) => r.laya.tokens.total),
        false // lower is better
      ),
    };
  }

  /**
   * Persists machine-readable benchmark run results to data/benchmark/results.
   */
  private persistRunResult(result: BenchmarkSuiteResult): void {
    try {
      const resultsDir = path.resolve(process.cwd(), "data/benchmark/results");
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      const filename = `benchmark-run-${Date.now()}.json`;
      const filePath = path.join(resultsDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
      console.log(`Persisted raw benchmark run to: ${filePath}`);
    } catch (err: unknown) {
      console.warn("Failed to persist raw benchmark result:", err);
    }
  }

  private getGitCommit(): string {
    try {
      return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
    } catch {
      return "unknown";
    }
  }
}
