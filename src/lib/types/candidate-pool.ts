import { Chunk } from "./chunk";

/**
 * Retrieval Configuration parameters
 */
export interface RetrievalConfig {
  /** Maximum number of candidate chunks to retrieve */
  topK: number;

  /** Minimum cosine similarity threshold (0.0 - 1.0) */
  similarityThreshold?: number;

  /** Identifier of embedding model used for query vectorization */
  embeddingModel: string;
}

/**
 * [SHARED CANDIDATE POOL]
 * The core experimental control in PatternRAG Lab.
 * Represents the identical, un-reranked candidate chunk pool produced by vector retrieval.
 * In later phases, this exact object is passed unchanged to:
 * - Path A (CrossEncoderEvaluator)
 * - Path B (LayaEvaluator)
 */
export interface CandidateChunkPool {
  /** Unique pool identifier */
  id: string;

  /** Original user query that produced this candidate pool */
  query: string;

  /** Query vector representation (optional, omitted in client responses) */
  queryVector?: number[];

  /** Timestamp when retrieval was performed */
  retrievedAt: number;

  /**
   * The candidate chunks retrieved via vector similarity search.
   * Every chunk holds:
   * - decision: 'pending' (retriever does NOT perform relevance filtering)
   * - retrievalScore: raw cosine similarity score
   * - rank: initial rank (1 to topK)
   */
  candidateChunks: Chunk[];

  /** Total number of candidate chunks in pool */
  totalCandidates: number;

  /** Configuration used during retrieval */
  retrievalConfig: RetrievalConfig;

  /** Embedding model identifier (e.g. 'nomic-embed-text') */
  embeddingModel: string;

  /** Isolated retrieval latency in milliseconds (query embed + vector search) */
  retrievalLatencyMs: number;

  /** Target document ID if query was constrained to a single document */
  documentId?: string;

  /** Diagnostics and trace metadata */
  metadata?: Record<string, unknown>;
}
