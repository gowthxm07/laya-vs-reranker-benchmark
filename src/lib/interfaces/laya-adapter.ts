import { Chunk } from "../types/chunk";

/**
 * Raw request format expected by the external Laya service/API
 */
export interface LayaRawPayload {
  query: string;
  items: Array<{
    id: string;
    text: string;
    metadata?: Record<string, unknown>;
  }>;
  parameters?: {
    threshold?: number;
    max_results?: number;
  };
}

/**
 * Raw response format returned by the external Laya service/API
 */
export interface LayaRawResponse {
  results: Array<{
    id: string;
    score: number;
    accepted: boolean;
    reason?: string;
  }>;
  processing_time_ms: number;
  metadata?: Record<string, unknown>;
}

/**
 * [ADAPTER PATTERN CONTRACT]
 * Decouples the application core and RelevanceEvaluator strategy from Laya's concrete external API shape.
 * Translates domain Chunks into Laya payloads and adapts Laya responses back into domain Chunks.
 */
export interface ILayaAdapter {
  /**
   * Adapts internal candidate chunks into Laya format, invokes Laya service boundary,
   * and adapts results back to domain Chunks.
   */
  filterCandidates(
    query: string,
    chunks: Chunk[],
    options?: { topK?: number; threshold?: number }
  ): Promise<{
    retainedChunks: Chunk[];
    discardedChunks: Chunk[];
    allCandidates?: Chunk[];
    adapterLatencyMs: number;
    modelLoadLatencyMs?: number;
    isColdStart?: boolean;
    layaModel?: string;
    rawResponse?: LayaRawResponse;
  }>;
}
