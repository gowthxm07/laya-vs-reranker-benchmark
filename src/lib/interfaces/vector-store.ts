/**
 * Vector entry stored in the local vector database
 */
export interface VectorEntry {
  /** Unique chunk identifier */
  id: string;

  /** Associated document identifier */
  documentId: string;

  /** Passage text content */
  text: string;

  /** Source document name (e.g. 'company-policy.pdf') */
  source?: string;

  /** Originating page number */
  pageNumber?: number;

  /** Section heading if available */
  section?: string;

  /** Ingestion metadata */
  metadata?: Record<string, unknown>;

  /** Dense numerical embedding vector */
  embedding: number[];
}

/**
 * Result item returned by vector similarity search
 */
export interface VectorSearchResult {
  /** The stored vector entry */
  entry: VectorEntry;

  /** Cosine similarity score between query vector and chunk vector */
  similarityScore: number;

  /** Retrieval rank (1-indexed) */
  rank: number;
}

/**
 * [VECTOR STORAGE CONTRACT]
 * Interface for local vector persistence, semantic indexing, and Top-K retrieval.
 */
export interface IVectorStore {
  /** Inserts a single vector entry into the store */
  insert(entry: VectorEntry): Promise<void>;

  /** Inserts multiple vector entries into the store */
  insertBatch(entries: VectorEntry[]): Promise<void>;

  /**
   * Performs semantic Top-K cosine similarity search
   */
  search(
    queryVector: number[],
    topK: number,
    options?: {
      minScore?: number;
      documentId?: string;
    }
  ): Promise<VectorSearchResult[]>;

  /** Returns total count of indexed vector entries */
  count(): Promise<number>;

  /** Returns distinct document IDs currently indexed */
  listDocuments(): Promise<string[]>;

  /** Removes all entries belonging to a given document */
  deleteDocument(documentId: string): Promise<number>;

  /** Clears the entire vector index */
  clear(): Promise<void>;
}
