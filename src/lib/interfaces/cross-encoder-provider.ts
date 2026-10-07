/**
 * Result of batch inference returned by CrossEncoderProvider
 */
export interface CrossEncoderPredictionResult {
  /** Raw cross-attention logit scores corresponding to each candidate text */
  scores: number[];

  /** Duration of warm batch evaluation in milliseconds */
  evaluationLatencyMs: number;

  /** Duration of cold-start model load in milliseconds (if applicable) */
  modelLoadLatencyMs?: number;

  /** True if this run required cold model loading */
  isColdStart: boolean;
}

/**
 * [STRATEGY / ADAPTER CONTRACT]
 * Pluggable cross-encoder provider abstraction.
 * Evaluates (query, passage) pairs jointly through a cross-encoder model.
 */
export interface CrossEncoderProvider {
  /** Unique provider identifier (e.g. 'python', 'mock') */
  readonly id: string;

  /** Cross-encoder model identifier (e.g. 'cross-encoder/ms-marco-MiniLM-L-6-v2') */
  readonly model: string;

  /**
   * Scores an array of candidate texts against a single query in a single batch.
   * Returns an array of cross-attention logit scores matching candidateTexts order.
   */
  predictScores(
    query: string,
    candidateTexts: string[]
  ): Promise<CrossEncoderPredictionResult>;

  /**
   * Verifies health, model availability, and execution environment
   */
  checkHealth(): Promise<{ isAvailable: boolean; message?: string }>;

  /**
   * Closes or cleans up any background worker processes
   */
  dispose?(): void;
}
