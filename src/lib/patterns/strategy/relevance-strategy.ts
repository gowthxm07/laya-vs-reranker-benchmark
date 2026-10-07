import {
  RelevanceEvaluator,
  RelevanceEvaluationRequest,
  RelevanceEvaluationResult,
} from "../../interfaces/relevance-evaluator";
import { CrossEncoderProvider } from "../../interfaces/cross-encoder-provider";
import { CrossEncoderProviderFactory } from "../../providers/cross-encoder-provider-factory";
import { ILayaAdapter } from "../../interfaces/laya-adapter";
import { LayaAdapter } from "../../adapters/laya-adapter";
import { LayaProvider } from "../../interfaces/laya-provider";
import { Chunk } from "../../types/chunk";

export {
  type EvaluatorStrategyType,
  type EvaluatorStrategyDescriptor,
  EVALUATOR_STRATEGIES,
} from "../../config/evaluator-strategies";

/**
 * [STRATEGY IMPLEMENTATION: CrossEncoderEvaluator]
 * Real Advanced RAG Cross-Encoder post-retrieval relevance evaluator strategy.
 * Uses CrossEncoderProvider to compute joint attention scores and re-ranks candidate pool.
 */
export class CrossEncoderEvaluator implements RelevanceEvaluator {
  readonly id = "cross-encoder";
  readonly name = "Cross-Encoder Reranker";
  readonly description =
    "Joint transformer cross-attention reranking for candidate passages.";
  private provider: CrossEncoderProvider;

  constructor(provider?: CrossEncoderProvider) {
    this.provider = provider || CrossEncoderProviderFactory.getProvider();
  }

  async evaluate(
    query: string,
    candidateChunks: Chunk[],
    options?: Record<string, unknown>
  ): Promise<RelevanceEvaluationResult> {
    return this.evaluateRelevance({ query, candidateChunks, options });
  }

  async evaluateRelevance(
    request: RelevanceEvaluationRequest
  ): Promise<RelevanceEvaluationResult> {
    const { query, candidateChunks, options } = request;

    if (!candidateChunks || candidateChunks.length === 0) {
      return {
        evaluatorId: this.id,
        retainedChunks: [],
        discardedChunks: [],
        latencyMs: 0,
        metadata: { candidateCount: 0, topN: options?.topK ?? 5 },
      };
    }

    const candidateTexts = candidateChunks.map((c) => c.text);
    const predictionResult = await this.provider.predictScores(
      query,
      candidateTexts
    );

    // Pair each chunk with its score and assign reranked position
    const scoredChunks: Array<{ chunk: Chunk; score: number }> = candidateChunks.map(
      (chunk, index) => ({
        chunk: {
          ...chunk,
          relevanceScore: predictionResult.scores[index] ?? 0,
        },
        score: predictionResult.scores[index] ?? 0,
      })
    );

    // Sort descending by cross-encoder score
    scoredChunks.sort((a, b) => b.score - a.score);

    const topN =
      (options?.topK as number) ??
      ((options as Record<string, unknown>)?.topN as number) ??
      5;
    const retainedChunks: Chunk[] = [];
    const discardedChunks: Chunk[] = [];

    scoredChunks.forEach((item, index) => {
      const newRank = index + 1;
      const isRetained = newRank <= topN;

      const updatedChunk: Chunk = {
        ...item.chunk,
        rank: newRank,
        decision: isRetained ? "retained" : "discarded",
        metadata: {
          ...item.chunk.metadata,
          originalRank: item.chunk.rank,
          crossEncoderScore: item.score,
        },
      };

      if (isRetained) {
        retainedChunks.push(updatedChunk);
      } else {
        discardedChunks.push(updatedChunk);
      }
    });

    return {
      evaluatorId: this.id,
      retainedChunks,
      discardedChunks,
      latencyMs: predictionResult.evaluationLatencyMs,
      metadata: {
        model: this.provider.model,
        candidateCount: candidateChunks.length,
        topN,
        isColdStart: predictionResult.isColdStart,
        modelLoadLatencyMs: predictionResult.modelLoadLatencyMs,
      },
    };
  }
}

/**
 * [STRATEGY IMPLEMENTATION: LayaEvaluator]
 * Real Laya post-retrieval relevance evaluator strategy (Path B).
 * Uses LayaAdapter to classify candidates as KEEP or DROP and prune candidate pool.
 */
export class LayaEvaluator implements RelevanceEvaluator {
  readonly id = "laya";
  readonly name = "Laya Relevance Filter";
  readonly description =
    "Non-autoregressive System 1 relevance evaluation and semantic pruning.";
  private adapter: ILayaAdapter;

  constructor(adapterOrProvider?: ILayaAdapter | LayaProvider) {
    if (adapterOrProvider && "filterCandidates" in adapterOrProvider) {
      this.adapter = adapterOrProvider;
    } else if (adapterOrProvider) {
      this.adapter = new LayaAdapter(adapterOrProvider as LayaProvider);
    } else {
      this.adapter = new LayaAdapter();
    }
  }

  async evaluate(
    query: string,
    candidateChunks: Chunk[],
    options?: Record<string, unknown>
  ): Promise<RelevanceEvaluationResult> {
    return this.evaluateRelevance({ query, candidateChunks, options });
  }

  async evaluateRelevance(
    request: RelevanceEvaluationRequest
  ): Promise<RelevanceEvaluationResult> {
    const { query, candidateChunks, options } = request;

    if (!candidateChunks || candidateChunks.length === 0) {
      return {
        evaluatorId: this.id,
        retainedChunks: [],
        discardedChunks: [],
        latencyMs: 0,
        metadata: { candidateCount: 0, retainedCount: 0, reductionPercent: 0 },
      };
    }

    const filterResult = await this.adapter.filterCandidates(
      query,
      candidateChunks,
      options as { topK?: number; threshold?: number }
    );

    const total = candidateChunks.length;
    const retained = filterResult.retainedChunks.length;
    const reductionPercent = Number(
      (((total - retained) / Math.max(1, total)) * 100).toFixed(1)
    );

    return {
      evaluatorId: this.id,
      retainedChunks: filterResult.retainedChunks,
      discardedChunks: filterResult.discardedChunks,
      latencyMs: filterResult.adapterLatencyMs,
      metadata: {
        model: filterResult.layaModel,
        candidateCount: total,
        retainedCount: retained,
        discardedCount: filterResult.discardedChunks.length,
        contextReductionPercent: reductionPercent,
        isColdStart: filterResult.isColdStart,
        modelLoadLatencyMs: filterResult.modelLoadLatencyMs,
      },
    };
  }
}

/**
 * [STRATEGY IMPLEMENTATION STUB: SimilarityThresholdEvaluator]
 */
export class SimilarityThresholdEvaluator implements RelevanceEvaluator {
  readonly id = "similarity-threshold";
  readonly name = "Similarity Threshold Baseline";
  readonly description = "Simple bi-encoder similarity score cutoff.";

  async evaluateRelevance(
    request: RelevanceEvaluationRequest
  ): Promise<RelevanceEvaluationResult> {
    throw new Error(
      `SimilarityThresholdEvaluator execution is planned for Phase 4 baseline. Evaluator strategy interface is active. (Query: "${request.query}")`
    );
  }
}
