import { Chunk } from "./chunk";

/**
 * Normalized machine-readable Laya decision type
 */
export type LayaDecisionType = "keep" | "drop";

/**
 * Individual candidate passage decision emitted by Laya
 */
export interface LayaDecision {
  /** Chunk identifier corresponding to the candidate passage */
  chunkId: string;

  /** Strict binary gating decision: "keep" to retain passage, "drop" to filter */
  decision: LayaDecisionType;

  /** Calibrated probability that passage is relevant (0.0 - 1.0) */
  keepProbability?: number;

  /** Calibrated probability that passage is irrelevant (0.0 - 1.0) */
  dropProbability?: number;

  /** Mathematical confidence score assigned by RLCD proper scoring rules */
  confidence?: number;

  /** Top answer confidence probability */
  answerConfidence?: number;

  /** Raw unnormalized runtime response for trace auditing */
  rawModelOutput?: Record<string, unknown>;
}

/**
 * Candidate chunk decorated with Laya relevance decision metadata
 */
export interface LayaFilteredCandidateChunk extends Chunk {
  /** Normalized Laya decision: "keep" or "drop" */
  layaDecision: LayaDecisionType;

  /** Whether the chunk was retained for prompt context inclusion */
  isRetained: boolean;

  /** Calibrated keep probability emitted by Laya */
  keepProbability?: number;

  /** Calibrated drop probability emitted by Laya */
  dropProbability?: number;

  /** Confidence metric reported by Laya */
  layaConfidence?: number;

  /** Original vector rank in the shared CandidateChunkPool */
  originalRank: number;

  /** Original bi-encoder cosine similarity score */
  originalRetrievalScore: number;
}

/**
 * Instrumentation metrics for the Laya relevance evaluation pass
 */
export interface LayaEvaluationMetrics {
  /** Total number of candidate chunks evaluated */
  candidateCount: number;

  /** Total number of candidate chunks retained ("keep") */
  retainedCount: number;

  /** Total number of candidate chunks discarded ("drop") */
  discardedCount: number;

  /** Context reduction percentage: ((candidateCount - retainedCount) / candidateCount) * 100 */
  contextReductionPercent: number;

  /** Active inference duration in milliseconds */
  evaluationLatencyMs: number;

  /** Average latency per evaluated candidate passage (ms) */
  averageCandidateLatencyMs: number;

  /** Total elapsed pipeline latency including IPC overhead (ms) */
  totalLatencyMs: number;

  /** Initial model weight loading duration in milliseconds (cold start) */
  modelLoadLatencyMs?: number;

  /** Whether this evaluation incurred a cold-start initialization cost */
  isColdStart: boolean;
}

/**
 * Complete filtered pool output produced by LayaRelevanceFilteringService (Path B)
 */
export interface LayaFilteredPool {
  /** Unique filtered pool identifier */
  id: string;

  /** The exact user query evaluated */
  query: string;

  /** Identifier of the originating shared CandidateChunkPool */
  originalPoolId: string;

  /** Timestamp when candidate chunks were retrieved from vector store */
  retrievedAt: number;

  /** Timestamp when Laya relevance evaluation completed */
  evaluatedAt: number;

  /** Active Laya model identifier or local checkpoint path */
  layaModel: string;

  /** Embedding model used for initial candidate retrieval */
  embeddingModel: string;

  /** Total number of candidate passages submitted to Laya */
  totalCandidates: number;

  /** Number of candidate passages retained ("keep") */
  retainedCount: number;

  /** Number of candidate passages filtered out ("drop") */
  discardedCount: number;

  /** Candidate context reduction percentage */
  contextReductionPercent: number;

  /** All candidate chunks with Laya decisions attached, ordered by original rank */
  candidates: LayaFilteredCandidateChunk[];

  /** Only the candidate chunks marked "keep", ready for downstream context */
  retainedCandidates: LayaFilteredCandidateChunk[];

  /** Only the candidate chunks marked "drop", excluded from prompt synthesis */
  discardedCandidates: LayaFilteredCandidateChunk[];

  /** Performance and reduction metrics */
  metrics: LayaEvaluationMetrics;

  /** Experimental relevance threshold applied to keepProbability (if specified) */
  filteringThreshold?: number;
}
