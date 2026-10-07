import { Chunk } from "../types/chunk";

/**
 * Options for context serialization
 */
export interface ContextFormatOptions {
  includeDocumentId?: boolean;
  includeScores?: boolean;
  includeSourceMetadata?: boolean;
  includePageNumber?: boolean;
  includeChunkId?: boolean;
  chunkDelimiter?: string;
}

/**
 * [BUILDER PATTERN CONTRACT]
 * Fluent builder for assembling, ordering, and formatting retrieved chunks
 * into a coherent prompt context string within token limits.
 */
export interface IContextBuilder {
  /** Adds a single retained chunk */
  addChunk(chunk: Chunk): this;

  /** Adds multiple retained chunks */
  addChunks(chunks: Chunk[]): this;

  /** Sets token budget limit */
  setMaxTokenBudget(tokens: number): this;

  /** Sorts chunks by relevance score or rank */
  sortByRelevance(): this;

  /** Configures formatting options */
  setFormatOptions(options: ContextFormatOptions): this;

  /** Resets builder state */
  reset(): this;

  /** Builds the final context string */
  build(): string;
}
