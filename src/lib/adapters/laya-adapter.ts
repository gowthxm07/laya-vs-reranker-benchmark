import { ILayaAdapter, LayaRawResponse } from "../interfaces/laya-adapter";
import { LayaProvider } from "../interfaces/laya-provider";
import { LayaProviderFactory } from "../providers/laya-provider-factory";
import { Chunk } from "../types/chunk";
import { LayaDecision, LayaFilteredCandidateChunk } from "../types/laya";

export interface LayaAdapterFilterResult {
  retainedChunks: LayaFilteredCandidateChunk[];
  discardedChunks: LayaFilteredCandidateChunk[];
  allCandidates: LayaFilteredCandidateChunk[];
  adapterLatencyMs: number;
  modelLoadLatencyMs?: number;
  isColdStart: boolean;
  layaModel: string;
  rawResponse?: LayaRawResponse;
}

/**
 * [ADAPTER PATTERN IMPLEMENTATION]
 * Adapts between the domain model (CandidateChunkPool / Chunk[]) and the concrete LayaProvider runtime.
 * Guarantees that internal candidates are correctly translated and mapped to strict KEEP/DROP decisions.
 */
export class LayaAdapter implements ILayaAdapter {
  private provider: LayaProvider;

  constructor(provider?: LayaProvider) {
    this.provider = provider || LayaProviderFactory.getProvider();
  }

  /**
   * Adapts candidate chunks to Laya format, invokes batch evaluation,
   * validates decisions, and returns partitioned domain chunks.
   */
  async filterCandidates(
    query: string,
    chunks: Chunk[],
    _options?: { topK?: number; threshold?: number }
  ): Promise<LayaAdapterFilterResult> {
    if (!query || !query.trim()) {
      throw new Error("Query cannot be empty for Laya relevance filtering.");
    }

    if (!chunks || chunks.length === 0) {
      return {
        retainedChunks: [],
        discardedChunks: [],
        allCandidates: [],
        adapterLatencyMs: 0,
        modelLoadLatencyMs: 0,
        isColdStart: false,
        layaModel: this.provider.model,
      };
    }

    const payloads = chunks.map((c) => ({
      id: c.id,
      text: c.text,
    }));

    const response = await this.provider.evaluateRelevance(query, payloads);

    // Map chunk ID -> LayaDecision
    const decisionMap = new Map<string, LayaDecision>();
    for (const d of response.decisions) {
      decisionMap.set(d.chunkId, d);
    }

    const retainedChunks: LayaFilteredCandidateChunk[] = [];
    const discardedChunks: LayaFilteredCandidateChunk[] = [];
    const allCandidates: LayaFilteredCandidateChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const decisionObj = decisionMap.get(chunk.id);

      if (!decisionObj) {
        throw new Error(
          `Laya provider did not return a relevance decision for candidate chunk '${chunk.id}'.`
        );
      }

      const decision = decisionObj.decision;
      if (decision !== "keep" && decision !== "drop") {
        throw new Error(
          `Invalid/unrecognized decision '${decision}' for chunk '${chunk.id}'. Expected 'keep' or 'drop'.`
        );
      }

      const isRetained = decision === "keep";
      const originalRank = chunk.rank ?? i + 1;
      const originalRetrievalScore = chunk.retrievalScore ?? 0;

      const decoratedChunk: LayaFilteredCandidateChunk = {
        ...chunk,
        layaDecision: decision,
        isRetained,
        decision: isRetained ? "retained" : "discarded",
        keepProbability: decisionObj.keepProbability,
        dropProbability: decisionObj.dropProbability,
        layaConfidence: decisionObj.confidence,
        originalRank,
        originalRetrievalScore,
        metadata: {
          ...chunk.metadata,
          originalRank,
          originalRetrievalScore,
          layaDecision: decision,
          keepProbability: decisionObj.keepProbability,
          dropProbability: decisionObj.dropProbability,
          confidence: decisionObj.confidence,
          answerConfidence: decisionObj.answerConfidence,
          rawOutput: decisionObj.rawModelOutput,
        },
      };

      allCandidates.push(decoratedChunk);
      if (isRetained) {
        retainedChunks.push(decoratedChunk);
      } else {
        discardedChunks.push(decoratedChunk);
      }
    }

    const rawResponse: LayaRawResponse = {
      results: response.decisions.map((d) => ({
        id: d.chunkId,
        score: d.keepProbability ?? (d.decision === "keep" ? 1.0 : 0.0),
        accepted: d.decision === "keep",
        reason: `Laya decision: ${d.decision} (confidence: ${d.confidence ?? "N/A"})`,
      })),
      processing_time_ms: response.evaluationLatencyMs,
      metadata: {
        model: response.model,
        isColdStart: response.isColdStart,
        modelLoadLatencyMs: response.modelLoadLatencyMs,
      },
    };

    return {
      retainedChunks,
      discardedChunks,
      allCandidates,
      adapterLatencyMs: response.evaluationLatencyMs,
      modelLoadLatencyMs: response.modelLoadLatencyMs,
      isColdStart: response.isColdStart,
      layaModel: response.model,
      rawResponse,
    };
  }
}
