import { CandidateChunkPool } from "../types/candidate-pool";

export interface RetrievalOptions {
  /** Target candidate count (default: 10) */
  topK?: number;

  /** Minimum similarity score threshold */
  similarityThreshold?: number;

  /** Scope retrieval to a specific document ID */
  documentId?: string;
}

/**
 * [RETRIEVER CONTRACT]
 * Produces the un-reranked, shared candidate chunk pool from vector search.
 * Strictly decoupled from post-retrieval relevance evaluation.
 */
export interface IRetriever {
  /**
   * Retrieves candidate passages for a query and bundles them into an immutable CandidateChunkPool.
   * DOES NOT perform reranking or relevance filtering.
   */
  retrieve(
    query: string,
    options?: RetrievalOptions
  ): Promise<CandidateChunkPool>;
}
