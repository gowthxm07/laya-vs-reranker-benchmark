/**
 * [STRATEGY / ADAPTER CONTRACT]
 * Pluggable local embedding provider abstraction.
 * Generates dense continuous vector representations from text passages and queries.
 */
export interface EmbeddingProvider {
  /** Unique provider identifier (e.g. 'ollama', 'mock') */
  readonly id: string;

  /** Embedding model name (e.g. 'nomic-embed-text') */
  readonly model: string;

  /**
   * Generates a single vector embedding for the input text passage or query
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Generates embeddings for a batch of text passages
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Returns the vector dimension dimensionality (e.g. 768)
   */
  getDimension(): Promise<number>;

  /**
   * Checks health and connectivity of the embedding backend
   */
  checkHealth(): Promise<{ isAvailable: boolean; message?: string }>;
}
