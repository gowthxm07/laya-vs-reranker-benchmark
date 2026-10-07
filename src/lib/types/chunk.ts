/**
 * Chunk Decision State
 * - 'retained': Selected by the evaluator strategy for context inclusion
 * - 'discarded': Filtered out as irrelevant or redundant
 * - 'pending': Retrieved candidate, not yet evaluated
 */
export type ChunkDecision = "retained" | "discarded" | "pending";

/**
 * Core Chunk Model
 * Represents a discrete text passage retrieved from a document collection.
 * The SAME candidate chunks are passed to both Advanced RAG and Laya RAG pipelines
 * to guarantee fair, controlled experimental evaluation.
 */
export interface Chunk {
  /** Unique chunk identifier across the corpus */
  id: string;

  /** Identifier of the originating parent document */
  documentId: string;

  /** Extracted raw textual passage content */
  text: string;

  /** Human-readable document name or origin URI */
  source?: string;

  /** Page number in source document, if applicable */
  pageNumber?: number;

  /** Structural section or heading where chunk is situated */
  section?: string;

  /** Arbitrary domain or ingestion metadata */
  metadata?: Record<string, unknown>;

  /** Initial vector/bi-encoder similarity retrieval score (e.g. cosine distance / BM25) */
  retrievalScore?: number;

  /** Post-retrieval relevance score assigned by evaluator (Cross-Encoder / Laya) */
  relevanceScore?: number;

  /** Evaluator decision: retained or discarded */
  decision?: ChunkDecision;

  /** Post-evaluation rank among candidate chunks (1-indexed) */
  rank?: number;

  /** Optional rationale or score breakdown emitted by the evaluator */
  relevanceRationale?: string;
}
