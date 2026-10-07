import { LayaDecision } from "../types/laya";

/**
 * Minimal candidate payload submitted to the Laya provider
 */
export interface LayaCandidatePayload {
  id: string;
  text: string;
}

/**
 * Result returned by LayaProvider batch evaluation
 */
export interface LayaEvaluationResponse {
  /** Array of normalized KEEP/DROP decisions for each candidate */
  decisions: LayaDecision[];

  /** Inference execution latency in milliseconds */
  evaluationLatencyMs: number;

  /** Initial model weight loading duration in milliseconds (if cold start) */
  modelLoadLatencyMs?: number;

  /** True if this evaluation incurred a cold-start model load */
  isColdStart: boolean;

  /** Active model identifier reported by provider */
  model: string;
}

/**
 * [PROVIDER CONTRACT]
 * Pluggable Laya relevance provider interface.
 * Isolates runtime execution (Python child process, local HTTP, or mock) from the domain model.
 */
export interface LayaProvider {
  /** Unique provider identifier (e.g. 'python', 'mock', 'http') */
  readonly id: string;

  /** Model identifier or checkpoint path */
  readonly model: string;

  /**
   * Evaluates relevance for all candidate passages against the query in a single batch pass.
   * Returns strict KEEP or DROP decisions with mathematical confidence.
   */
  evaluateRelevance(
    query: string,
    candidates: LayaCandidatePayload[]
  ): Promise<LayaEvaluationResponse>;

  /**
   * Checks runtime availability and model health
   */
  checkHealth(): Promise<{ isAvailable: boolean; message?: string }>;

  /**
   * Disposes background resources or child processes
   */
  dispose?(): void;
}
