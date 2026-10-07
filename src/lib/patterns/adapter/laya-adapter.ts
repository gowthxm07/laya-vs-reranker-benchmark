import { Chunk } from "../../types/chunk";
import { ILayaAdapter, LayaRawPayload, LayaRawResponse } from "../../interfaces/laya-adapter";

export interface LayaAdapterConfig {
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * [ADAPTER PATTERN IMPLEMENTATION]
 * Wraps external Laya service interaction, adapting internal domain Chunks
 * into Laya-compliant payloads and translating Laya scoring into domain decisions.
 * Decouples core application logic from any Laya API contract changes.
 */
export class LayaAdapter implements ILayaAdapter {
  private config: LayaAdapterConfig;

  constructor(config?: Partial<LayaAdapterConfig>) {
    this.config = {
      endpoint: config?.endpoint || process.env.LAYA_API_ENDPOINT || "http://localhost:8080/v1",
      apiKey: config?.apiKey || process.env.LAYA_API_KEY,
      timeoutMs: config?.timeoutMs || 10000,
    };
  }

  /**
   * Translates domain Chunks into external Laya payload structure
   */
  adaptToLayaPayload(
    query: string,
    chunks: Chunk[],
    options?: { topK?: number; threshold?: number }
  ): LayaRawPayload {
    return {
      query,
      items: chunks.map((c) => ({
        id: c.id,
        text: c.text,
        metadata: {
          documentId: c.documentId,
          source: c.source,
          ...c.metadata,
        },
      })),
      parameters: {
        max_results: options?.topK,
        threshold: options?.threshold,
      },
    };
  }

  /**
   * Adapts raw Laya response back into domain Chunk decisions
   */
  adaptFromLayaResponse(
    candidateChunks: Chunk[],
    response: LayaRawResponse
  ): { retainedChunks: Chunk[]; discardedChunks: Chunk[] } {
    const responseMap = new Map(response.results.map((r) => [r.id, r]));

    const retainedChunks: Chunk[] = [];
    const discardedChunks: Chunk[] = [];

    for (const chunk of candidateChunks) {
      const layaItem = responseMap.get(chunk.id);
      if (layaItem && layaItem.accepted) {
        retainedChunks.push({
          ...chunk,
          relevanceScore: layaItem.score,
          decision: "retained",
          relevanceRationale: layaItem.reason,
        });
      } else {
        discardedChunks.push({
          ...chunk,
          relevanceScore: layaItem ? layaItem.score : undefined,
          decision: "discarded",
          relevanceRationale: layaItem?.reason,
        });
      }
    }

    return { retainedChunks, discardedChunks };
  }

  /**
   * Invokes Laya service boundary (stubbed in Phase 1)
   */
  async filterCandidates(
    query: string,
    chunks: Chunk[],
    _options?: { topK?: number; threshold?: number }
  ): Promise<{
    retainedChunks: Chunk[];
    discardedChunks: Chunk[];
    adapterLatencyMs: number;
    rawResponse?: LayaRawResponse;
  }> {
    throw new Error(
      `LayaAdapter integration will be connected in Phase 3. Adapter boundary contract is defined. (Query: "${query}", Candidates: ${chunks.length})`
    );
  }
}
