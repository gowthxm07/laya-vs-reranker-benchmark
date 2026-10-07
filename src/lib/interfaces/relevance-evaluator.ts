import { Chunk } from "../types/chunk";

/**
 * Options passed to the relevance evaluator strategy
 */
export interface RelevanceEvaluationOptions {
  /** Maximum number of chunks to retain in the final context (Top-K) */
  topK?: number;

  /** Minimum relevance score threshold to retain a chunk */
  scoreThreshold?: number;

  /** Additional strategy-specific tuning parameters */
  metadata?: Record<string, unknown>;
}

/**
 * Evaluation payload submitted to a relevance evaluator strategy
 */
export interface RelevanceEvaluationRequest {
  /** User query text */
  query: string;

  /** Identical candidate chunks retrieved from the document store */
  candidateChunks: Chunk[];

  /** Optional evaluation tuning options */
  options?: RelevanceEvaluationOptions;
}

/**
 * Structured output returned by a relevance evaluator strategy
 */
export interface RelevanceEvaluationResult {
  /** Strategy identifier that performed the evaluation */
  evaluatorId: string;

  /** Candidate chunks retained for context */
  retainedChunks: Chunk[];

  /** Candidate chunks discarded by the strategy */
  discardedChunks: Chunk[];

  /** Duration of the relevance evaluation step in milliseconds */
  latencyMs: number;

  /** Evaluator-specific metadata or diagnostic information */
  metadata?: Record<string, unknown>;
}

/**
 * [STRATEGY PATTERN CONTRACT]
 * Common interface for interchangeable post-retrieval relevance evaluation strategies.
 * Implementations may include:
 * - CrossEncoderEvaluator (Advanced RAG baseline)
 * - LayaEvaluator (Laya relevance filtering)
 * - SimilarityThresholdEvaluator (Simple vector baseline)
 * - FutureLLMEvaluator (LLM-as-a-reranker)
 */
export interface RelevanceEvaluator {
  /** Unique strategy identifier */
  readonly id: string;

  /** Human-readable strategy name */
  readonly name: string;

  /** Architectural description of how this strategy evaluates relevance */
  readonly description: string;

  /**
   * Evaluates and filters candidate chunks for a given query.
   * Modifies chunk decision states ('retained' | 'discarded') and assigns relevanceScore.
   */
  evaluateRelevance(
    request: RelevanceEvaluationRequest
  ): Promise<RelevanceEvaluationResult>;
}
