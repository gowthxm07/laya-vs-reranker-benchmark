import { Chunk } from "./chunk";

/**
 * A Candidate Chunk enriched with Cross-Encoder relevance scoring and new rank
 */
export interface RerankedCandidateChunk extends Chunk {
  /** Original retrieval rank from vector search (1-indexed) */
  originalRank: number;

  /** Original bi-encoder cosine similarity score */
  originalRetrievalScore: number;

  /** Raw cross-attention logit score assigned by Cross-Encoder model */
  crossEncoderScore: number;

  /** Reranked position after sorting by crossEncoderScore descending (1-indexed) */
  rerankedRank: number;

  /** Rank delta: originalRank - rerankedRank (positive = moved up in priority) */
  rankDelta: number;

  /** True if within selected Top-N subset */
  isSelected: boolean;
}

/**
 * Latency and throughput metrics captured during cross-encoder execution
 */
export interface RelevanceEvaluationMetrics {
  /** Number of candidate passages evaluated jointly with the query */
  candidateCount: number;

  /** Time taken to load/initialize the model (cold start) */
  modelLoadLatencyMs?: number;

  /** Time taken for warm batch inference across all query-passage pairs */
  evaluationLatencyMs: number;

  /** Average latency per evaluated candidate (evaluationLatencyMs / candidateCount) */
  averageCandidateLatencyMs: number;

  /** Total latency for the reranking stage */
  totalLatencyMs: number;

  /** Whether this evaluation incurred a cold-start model load */
  isColdStart?: boolean;
}

/**
 * [RERANKED CANDIDATE POOL]
 * Result of applying the Cross-Encoder relevance strategy to a CandidateChunkPool.
 * Preserves the full candidate set with original and reranked positions.
 */
export interface RerankedCandidatePool {
  /** Unique reranking run ID */
  id: string;

  /** Original user query */
  query: string;

  /** ID of the input CandidateChunkPool */
  originalPoolId: string;

  /** Retrieval timestamp */
  retrievedAt: number;

  /** Timestamp when reranking completed */
  rerankedAt: number;

  /** Cross-encoder model identifier (e.g. 'cross-encoder/ms-marco-MiniLM-L-6-v2') */
  crossEncoderModel: string;

  /** Embedding model used in original retrieval */
  embeddingModel: string;

  /** Number of candidates in input pool */
  topKRetrieved: number;

  /** Number of candidates selected for context (Top-N) */
  topNSelected: number;

  /** All evaluated candidates sorted descending by crossEncoderScore */
  candidates: RerankedCandidateChunk[];

  /** The Top-N highest-ranked candidates selected for downstream context */
  selectedCandidates: RerankedCandidateChunk[];

  /** Detailed latency and performance metrics */
  metrics: RelevanceEvaluationMetrics;
}
