/**
 * Evaluation and Performance Metrics
 * Captures latency, token consumption, chunk retention efficiency,
 * and downstream quality metrics.
 */
export interface EvaluationMetrics {
  /**
   * Proportion of candidate chunks filtered out:
   * (candidateChunkCount - retainedChunkCount) / candidateChunkCount
   */
  contextReductionRate?: number;

  /** Estimated prompt token savings compared to passing all candidate chunks */
  tokenSavingsCount?: number;

  /** Evaluator-specific average relevance score of retained chunks */
  averageRetainedScore?: number;

  /** Optional LLM-as-a-judge faithfulness metric (Phase 4+) */
  faithfulnessScore?: number;

  /** Optional LLM-as-a-judge answer relevancy score (Phase 4+) */
  answerRelevanceScore?: number;
}

/**
 * Head-to-Head Comparison Metrics between Advanced RAG and Laya RAG
 */
export interface ComparisonMetrics {
  /** Advanced latency minus Laya latency (positive = Laya is faster) */
  latencyDeltaMs?: number;

  /** Advanced tokens minus Laya tokens (positive = Laya consumed fewer tokens) */
  tokenDelta?: number;

  /** Difference in number of chunks retained */
  retainedChunkDelta?: number;

  /** Difference in context reduction rate */
  contextReductionDelta?: number;

  /** Higher-level evaluation verdict based on configured metric priority */
  preferredApproach?: "advanced-rag" | "laya-rag" | "tie" | "inconclusive";

  /** Qualitative observation or summary note */
  summaryNote?: string;
}
