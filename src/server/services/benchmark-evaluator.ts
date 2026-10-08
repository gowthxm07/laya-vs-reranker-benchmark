import {
  RelevanceMetrics,
  ContextEfficiencyMetrics,
  AnswerQualityMetrics,
  FailureClassification,
  MetricAggregate,
  PairedComparisonSummary,
  ParetoAnalysisSummary,
  StrategyCaseEvaluation,
  BenchmarkCase,
} from "@/lib/types/benchmark";
import { PathComparisonResult } from "@/lib/types/comparison";

export class BenchmarkEvaluator {
  /**
   * Evaluates relevance selection metrics: Precision, Recall, F1, Hit Rate, MRR, NDCG.
   */
  public static evaluateRelevance(
    selectedChunkIds: string[],
    groundTruthRelevantIds: string[],
    isRankingStrategy: boolean = false,
    rankedOrderIds?: string[]
  ): RelevanceMetrics {
    const relevantSet = new Set(groundTruthRelevantIds);
    const selectedSet = new Set(selectedChunkIds);

    // If there are 0 ground truth relevant chunks (e.g. purely irrelevant distractor pool)
    if (groundTruthRelevantIds.length === 0) {
      const precision = selectedChunkIds.length === 0 ? 1 : 0;
      const recall = 1;
      const f1 = selectedChunkIds.length === 0 ? 1 : 0;
      const hitRate = selectedChunkIds.length === 0 ? 1 : 0;
      return {
        precision,
        recall,
        f1,
        hitRate,
        mrr: isRankingStrategy ? 1 : null,
        ndcg: isRankingStrategy ? 1 : null,
        isRankingMetricApplicable: isRankingStrategy,
      };
    }

    // Number of relevant chunks actually selected
    let relevantRetained = 0;
    for (const id of selectedSet) {
      if (relevantSet.has(id)) {
        relevantRetained++;
      }
    }

    const precision =
      selectedChunkIds.length > 0
        ? Number((relevantRetained / selectedChunkIds.length).toFixed(4))
        : 0;

    const recall =
      groundTruthRelevantIds.length > 0
        ? Number((relevantRetained / groundTruthRelevantIds.length).toFixed(4))
        : 0;

    const f1 =
      precision + recall > 0
        ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
        : 0;

    const hitRate = relevantRetained > 0 ? 1 : 0;

    // MRR & NDCG for ranking strategies (e.g. Cross-Encoder)
    let mrr: number | null = null;
    let ndcg: number | null = null;

    if (isRankingStrategy && rankedOrderIds && rankedOrderIds.length > 0) {
      // MRR: Reciprocal rank of the first relevant chunk
      for (let i = 0; i < rankedOrderIds.length; i++) {
        if (relevantSet.has(rankedOrderIds[i])) {
          mrr = Number((1 / (i + 1)).toFixed(4));
          break;
        }
      }
      if (mrr === null) mrr = 0;

      // NDCG@K
      ndcg = this.calculateNDCG(rankedOrderIds, relevantSet);
    }

    return {
      precision,
      recall,
      f1,
      hitRate,
      mrr,
      ndcg,
      isRankingMetricApplicable: isRankingStrategy,
    };
  }

  /**
   * Calculates NDCG for a ranked sequence of IDs given binary relevance.
   */
  private static calculateNDCG(
    rankedIds: string[],
    relevantSet: Set<string>
  ): number {
    let dcg = 0;
    for (let i = 0; i < rankedIds.length; i++) {
      const rel = relevantSet.has(rankedIds[i]) ? 1 : 0;
      if (rel > 0) {
        dcg += rel / Math.log2(i + 2); // i=0 -> log2(2) = 1
      }
    }

    // Ideal DCG: all relevant items at the top
    const totalRelevant = Math.min(relevantSet.size, rankedIds.length);
    let idcg = 0;
    for (let i = 0; i < totalRelevant; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    if (idcg === 0) return 1;
    return Number((dcg / idcg).toFixed(4));
  }

  /**
   * Calculates context efficiency metrics (retention rate, character/token reduction %).
   */
  public static evaluateContextEfficiency(
    initialCount: number,
    retainedCount: number,
    initialChars: number,
    retainedChars: number,
    initialTokens: number,
    retainedTokens: number
  ): ContextEfficiencyMetrics {
    const retentionRate =
      initialCount > 0 ? Number((retainedCount / initialCount).toFixed(4)) : 0;

    const contextReductionPercent =
      initialCount > 0
        ? Number((((initialCount - retainedCount) / initialCount) * 100).toFixed(2))
        : 0;

    const characterReductionPercent =
      initialChars > 0
        ? Number(
            (
              ((Math.max(0, initialChars - retainedChars)) / initialChars) *
              100
            ).toFixed(2)
          )
        : 0;

    const tokenReductionPercent =
      initialTokens > 0
        ? Number(
            (
              ((Math.max(0, initialTokens - retainedTokens)) / initialTokens) *
              100
            ).toFixed(2)
          )
        : 0;

    return {
      initialCandidateCount: initialCount,
      retainedCount,
      retentionRate,
      contextReductionPercent,
      initialContextCharacters: initialChars,
      retainedContextCharacters: retainedChars,
      characterReductionPercent,
      initialContextTokens: initialTokens,
      retainedContextTokens: retainedTokens,
      tokenReductionPercent,
    };
  }

  /**
   * Evaluates deterministic answer quality:
   * - Exact Match (case/punctuation normalized)
   * - Reference Answer lexical & token similarity
   * - Required facts / keywords coverage
   * - No-answer compliance (hallucination resistance when answerable = false)
   * - Faithfulness / Groundedness score against selected context
   */
  public static evaluateAnswerQuality(
    answer: string,
    referenceAnswer: string,
    answerable: boolean,
    requiredFacts: string[] = [],
    selectedContextText: string = ""
  ): AnswerQualityMetrics {
    const normAnswer = this.normalizeText(answer);
    const normRef = this.normalizeText(referenceAnswer);

    // 1. Exact match (case & whitespace insensitive)
    const exactMatch = normAnswer === normRef;

    // 2. Reference Answer Token Similarity (Jaccard + Bigram overlap)
    const refSimilarity = this.calculateTextSimilarity(normAnswer, normRef);

    // 3. Fact / Keyword Coverage
    let coveredFacts = 0;
    if (requiredFacts.length > 0) {
      for (const fact of requiredFacts) {
        const normFact = this.normalizeText(fact);
        if (normAnswer.includes(normFact)) {
          coveredFacts++;
        } else {
          // Multi-token fact matching: all substantive tokens present in normalized answer
          const factTokens = normFact.split(" ").filter((t) => t.length > 2);
          if (
            factTokens.length > 1 &&
            factTokens.every((token) => normAnswer.includes(token))
          ) {
            coveredFacts++;
          }
        }
      }
    }
    const factCoverage =
      requiredFacts.length > 0
        ? Number((coveredFacts / requiredFacts.length).toFixed(4))
        : 1.0;

    // 4. No-Answer Compliance (for unanswerable cases)
    let noAnswerCompliance: boolean | undefined = undefined;
    if (!answerable) {
      // Detect refusal phrases indicating acknowledgment of insufficient context
      const refusalKeywords = [
        "cannot be determined",
        "not enough information",
        "insufficient",
        "not mentioned",
        "not provided",
        "not found",
        "does not contain",
        "unable to determine",
        "no information",
        "no relevant",
        "context does not",
        "neither mentioned",
      ];
      const hasRefusal = refusalKeywords.some((kw) => normAnswer.includes(kw));

      // Also ensure it does not hallucinate facts if any facts are forbidden/absent
      noAnswerCompliance = hasRefusal;
    }

    // 5. Deterministic Faithfulness / Lexical Groundedness
    // Proportion of meaningful content words in the answer that appear in the context
    const lexicalGroundedness = this.calculateFaithfulness(
      answer,
      selectedContextText
    );

    return {
      exactMatch,
      referenceAnswerSimilarity: refSimilarity,
      factCoverage,
      noAnswerCompliance,
      faithfulnessScore: lexicalGroundedness,
      lexicalGroundednessScore: lexicalGroundedness,
    };
  }

  /**
   * Normalizes text by lowercasing, stripping extra whitespace and punctuation.
   */
  public static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Token-level Jaccard & dice coefficient similarity.
   */
  public static calculateTextSimilarity(a: string, b: string): number {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0.0;

    const tokensA = new Set(a.split(" ").filter((w) => w.length > 1));
    const tokensB = new Set(b.split(" ").filter((w) => w.length > 1));

    if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }

    const union = new Set([...tokensA, ...tokensB]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    // Dice coefficient: (2 * |A ∩ B|) / (|A| + |B|)
    const dice = (2 * intersection) / (tokensA.size + tokensB.size);

    return Number(((jaccard * 0.5 + dice * 0.5)).toFixed(4));
  }

  /**
   * Deterministic evidence support check:
   * Extracts content tokens (length > 3, excluding stopwords) from the answer
   * and measures the fraction that exist in the selected context.
   */
  private static calculateFaithfulness(
    answer: string,
    context: string
  ): number {
    if (!answer || !answer.trim()) return 0;
    if (!context || !context.trim()) {
      // If context was empty, an answer stating refusal is 100% faithful
      const refusalKeywords = [
        "cannot be determined",
        "not enough information",
        "insufficient",
        "not mentioned",
        "not provided",
      ];
      const norm = this.normalizeText(answer);
      return refusalKeywords.some((kw) => norm.includes(kw)) ? 1.0 : 0.0;
    }

    const stopwords = new Set([
      "the", "and", "that", "this", "with", "from", "for", "have", "been",
      "which", "what", "were", "they", "their", "there", "these", "those",
      "about", "into", "through", "after", "before", "while", "during",
      "according", "passage", "passages", "based", "stated", "states",
    ]);

    const normAnswer = this.normalizeText(answer);
    const normContext = this.normalizeText(context);

    const answerWords = normAnswer
      .split(" ")
      .filter((w) => w.length > 3 && !stopwords.has(w));

    if (answerWords.length === 0) return 1.0;

    let groundedWords = 0;
    for (const w of answerWords) {
      if (normContext.includes(w)) {
        groundedWords++;
      }
    }

    return Number((groundedWords / answerWords.length).toFixed(4));
  }

  /**
   * Classifies failure patterns between Cross-Encoder and Laya for a single benchmark case.
   */
  public static classifyFailures(
    groundTruthRelevantIds: string[],
    ceSelectedIds: string[],
    layaSelectedIds: string[],
    answerable: boolean,
    ceNoAnswerCompliance?: boolean,
    layaNoAnswerCompliance?: boolean
  ): {
    crossEncoderFailures: string[];
    layaFailures: string[];
    classification: FailureClassification;
    notes: string;
  } {
    const relevantSet = new Set(groundTruthRelevantIds);
    const ceSet = new Set(ceSelectedIds);
    const layaSet = new Set(layaSelectedIds);

    const ceFailures: string[] = [];
    const layaFailures: string[] = [];

    // Relevant chunks missed (False Negatives)
    for (const id of relevantSet) {
      if (!ceSet.has(id)) {
        ceFailures.push(`MISS_RELEVANT_${id}`);
      }
      if (!layaSet.has(id)) {
        layaFailures.push(`MISS_RELEVANT_${id}`);
      }
    }

    // Irrelevant chunks retained (False Positives)
    for (const id of ceSet) {
      if (!relevantSet.has(id)) {
        ceFailures.push(`RETAIN_IRRELEVANT_${id}`);
      }
    }
    for (const id of layaSet) {
      if (!relevantSet.has(id)) {
        layaFailures.push(`RETAIN_IRRELEVANT_${id}`);
      }
    }

    // Unanswerable case failure: hallunication / lack of refusal
    if (!answerable) {
      if (ceNoAnswerCompliance === false) {
        ceFailures.push("FAILED_NO_ANSWER_REFUSAL");
      }
      if (layaNoAnswerCompliance === false) {
        layaFailures.push("FAILED_NO_ANSWER_REFUSAL");
      }
    }

    let classification: FailureClassification = "PARTIAL_AGREEMENT";

    const ceCorrect = ceFailures.length === 0;
    const layaCorrect = layaFailures.length === 0;

    if (ceCorrect && layaCorrect) {
      classification = "BOTH_CORRECT";
    } else if (!ceCorrect && !layaCorrect) {
      classification = "BOTH_INCORRECT";
    } else if (!ceCorrect && layaCorrect) {
      classification = ceFailures.some((f) => f.startsWith("MISS_RELEVANT"))
        ? "CROSS_ENCODER_FALSE_NEGATIVE"
        : "CROSS_ENCODER_FALSE_POSITIVE";
    } else if (ceCorrect && !layaCorrect) {
      classification = layaFailures.some((f) => f.startsWith("MISS_RELEVANT"))
        ? "LAYA_FALSE_NEGATIVE"
        : "LAYA_FALSE_POSITIVE";
    }

    const notes = `CE Failures: [${ceFailures.join(", ") || "none"}], Laya Failures: [${
      layaFailures.join(", ") || "none"
    }]`;

    return {
      crossEncoderFailures: ceFailures,
      layaFailures: layaFailures,
      classification,
      notes,
    };
  }

  /**
   * Evaluates a single PathComparisonResult against the ground-truth benchmark case.
   */
  public static evaluatePathResult(
    pathResult: PathComparisonResult,
    benchmarkCase: BenchmarkCase,
    initialCandidateCount: number,
    initialCandidateChars: number,
    initialCandidateTokens: number
  ): StrategyCaseEvaluation {
    const isRanking = pathResult.strategyId === "cross-encoder";

    // Ranked order chunk IDs for NDCG & MRR
    let rankedOrderIds: string[] | undefined = undefined;
    if (isRanking && pathResult.metadata?.rerankScores) {
      const scores = pathResult.metadata.rerankScores as { id: string }[];
      rankedOrderIds = scores.map((s) => s.id);
    } else if (isRanking) {
      rankedOrderIds = pathResult.selectedChunkIds;
    }

    // 1. Relevance Metrics
    const relevanceMetrics = this.evaluateRelevance(
      pathResult.selectedChunkIds,
      benchmarkCase.relevantChunkIds,
      isRanking,
      rankedOrderIds
    );

    // 2. Context Efficiency Metrics
    const contextMetrics = this.evaluateContextEfficiency(
      initialCandidateCount,
      pathResult.retainedCount,
      initialCandidateChars,
      pathResult.contextCharacterCount,
      initialCandidateTokens,
      pathResult.contextTokenCount
    );

    // 3. Answer Quality Metrics
    const answerMetrics = this.evaluateAnswerQuality(
      pathResult.answer,
      benchmarkCase.referenceAnswer,
      benchmarkCase.answerable,
      benchmarkCase.requiredFacts || [],
      pathResult.contextText
    );

    const tokensSaved = Math.max(
      0,
      initialCandidateTokens - pathResult.totalTokens
    );
    const tokenReductionPercent =
      initialCandidateTokens > 0
        ? Number(
            (
              ((initialCandidateTokens - pathResult.totalTokens) /
                initialCandidateTokens) *
              100
            ).toFixed(2)
          )
        : 0;

    return {
      strategyId: (pathResult.strategyId === "laya" ? "laya" : "cross-encoder") as "cross-encoder" | "laya",
      strategyName: pathResult.strategyName,
      selectedChunkIds: pathResult.selectedChunkIds,
      relevanceMetrics,
      contextMetrics,
      answer: pathResult.answer,
      answerMetrics,
      latencies: {
        relevanceMs: pathResult.relevanceLatencyMs,
        contextBuildMs: pathResult.contextBuildLatencyMs,
        generationMs: pathResult.generationLatencyMs,
        totalMs: pathResult.totalLatencyMs,
      },
      tokens: {
        prompt: pathResult.promptTokens,
        completion: pathResult.completionTokens,
        total: pathResult.totalTokens,
        tokensSaved,
        tokenReductionPercent,
      },
      error: pathResult.error,
    };
  }

  /**
   * Computes robust summary statistics for an array of numbers.
   */
  public static computeAggregate(values: number[]): MetricAggregate {
    if (values.length === 0) {
      return { count: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0 };
    }

    const n = values.length;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = Number((sum / n).toFixed(4));

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    const median =
      n % 2 !== 0
        ? sorted[mid]
        : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(4));

    const min = sorted[0];
    const max = sorted[n - 1];

    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Number(Math.sqrt(variance).toFixed(4));

    return {
      count: n,
      mean,
      median,
      min,
      max,
      stdDev,
    };
  }

  /**
   * Computes paired difference statistics (Cross-Encoder minus Laya).
   */
  public static computePairedComparison(
    metricName: string,
    ceValues: number[],
    layaValues: number[],
    higherIsBetter: boolean = true
  ): PairedComparisonSummary {
    const count = Math.min(ceValues.length, layaValues.length);
    if (count === 0) {
      return {
        metricName,
        meanDifference: 0,
        medianDifference: 0,
        ceBetterCount: 0,
        layaBetterCount: 0,
        tieCount: 0,
        totalComparisons: 0,
      };
    }

    const diffs: number[] = [];
    let ceBetter = 0;
    let layaBetter = 0;
    let ties = 0;

    for (let i = 0; i < count; i++) {
      const diff = ceValues[i] - layaValues[i];
      diffs.push(diff);

      const tolerance = 0.0001;
      if (Math.abs(diff) < tolerance) {
        ties++;
      } else if (higherIsBetter) {
        if (diff > 0) ceBetter++;
        else layaBetter++;
      } else {
        // Lower is better (e.g. latency or tokens)
        if (diff < 0) ceBetter++;
        else layaBetter++;
      }
    }

    const agg = this.computeAggregate(diffs);

    return {
      metricName,
      meanDifference: agg.mean,
      medianDifference: agg.median,
      ceBetterCount: ceBetter,
      layaBetterCount: layaBetter,
      tieCount: ties,
      totalComparisons: count,
    };
  }

  /**
   * Performs multi-dimensional Pareto tradeoff analysis.
   * Compares each query case across dimensions:
   * 1. Relevance F1 (higher is better)
   * 2. Fact Coverage (higher is better)
   * 3. Context Reduction % (higher is better)
   * 4. Relevance Latency (lower is better)
   * 5. Total Latency (lower is better)
   */
  public static computeParetoAnalysis(
    ceF1: number[],
    layaF1: number[],
    ceCoverage: number[],
    layaCoverage: number[],
    ceContextRed: number[],
    layaContextRed: number[],
    ceRelLatency: number[],
    layaRelLatency: number[],
    ceTotLatency: number[],
    layaTotLatency: number[]
  ): ParetoAnalysisSummary {
    const count = ceF1.length;
    let ceDominates = 0;
    let layaDominates = 0;
    let tradeoffs = 0;

    for (let i = 0; i < count; i++) {
      // CE comparisons: >= for benefits, <= for costs
      const ceBetterOrEqual =
        ceF1[i] >= layaF1[i] &&
        ceCoverage[i] >= layaCoverage[i] &&
        ceContextRed[i] >= layaContextRed[i] &&
        ceRelLatency[i] <= layaRelLatency[i] &&
        ceTotLatency[i] <= layaTotLatency[i];

      const ceStrictlyBetter =
        ceF1[i] > layaF1[i] ||
        ceCoverage[i] > layaCoverage[i] ||
        ceContextRed[i] > layaContextRed[i] ||
        ceRelLatency[i] < layaRelLatency[i] ||
        ceTotLatency[i] < layaTotLatency[i];

      const layaBetterOrEqual =
        layaF1[i] >= ceF1[i] &&
        layaCoverage[i] >= ceCoverage[i] &&
        layaContextRed[i] >= ceContextRed[i] &&
        layaRelLatency[i] <= ceRelLatency[i] &&
        layaTotLatency[i] <= ceTotLatency[i];

      const layaStrictlyBetter =
        layaF1[i] > ceF1[i] ||
        layaCoverage[i] > ceCoverage[i] ||
        layaContextRed[i] > ceContextRed[i] ||
        layaRelLatency[i] < ceRelLatency[i] ||
        layaTotLatency[i] < ceTotLatency[i];

      if (ceBetterOrEqual && ceStrictlyBetter) {
        ceDominates++;
      } else if (layaBetterOrEqual && layaStrictlyBetter) {
        layaDominates++;
      } else {
        tradeoffs++;
      }
    }

    const summary = `Evaluated across 5 dimensions (Relevance F1, Fact Coverage, Context Reduction, Relevance Latency, Total Latency). Cross-Encoder dominates on ${ceDominates} cases, Laya dominates on ${layaDominates} cases, and ${tradeoffs} cases exhibit multi-attribute Pareto tradeoffs.`;

    return {
      dimensions: [
        "Relevance F1",
        "Fact Coverage",
        "Context Reduction %",
        "Relevance Latency (ms)",
        "Total Latency (ms)",
      ],
      ceDominatesLayaCount: ceDominates,
      layaDominatesCeCount: layaDominates,
      tradeoffCount: tradeoffs,
      summary,
    };
  }
}
