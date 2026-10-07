import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import {
  RerankedCandidateChunk,
  RerankedCandidatePool,
  RelevanceEvaluationMetrics,
} from "@/lib/types/reranker";
import { CrossEncoderProvider } from "@/lib/interfaces/cross-encoder-provider";
import { CrossEncoderProviderFactory } from "@/lib/providers/cross-encoder-provider-factory";
import { IObservablePipeline } from "@/lib/interfaces/observer";

export interface RerankingOptions {
  /** Maximum number of top candidates to select after reranking (default: 5) */
  topN?: number;
}

/**
 * [CROSS-ENCODER RERANKING SERVICE]
 * Coordinates post-retrieval cross-encoder re-ranking for Advanced RAG.
 * Consumes the shared CandidateChunkPool and produces a RerankedCandidatePool.
 */
export class CrossEncoderRerankingService {
  private provider: CrossEncoderProvider;
  private observerSubject?: IObservablePipeline;

  constructor(
    provider?: CrossEncoderProvider,
    observerSubject?: IObservablePipeline
  ) {
    this.provider = provider || CrossEncoderProviderFactory.getProvider();
    this.observerSubject = observerSubject;
  }

  /**
   * Re-ranks all candidates in a CandidateChunkPool using joint cross-attention scoring.
   * Preserves all original retrieval metadata and assigns new ranks and Top-N selection.
   */
  async rerankPool(
    pool: CandidateChunkPool,
    options?: RerankingOptions
  ): Promise<RerankedCandidatePool> {
    if (!pool) {
      throw new Error("CandidateChunkPool cannot be null or undefined.");
    }

    const { query, candidateChunks } = pool;
    if (!query || !query.trim()) {
      throw new Error("Query cannot be empty for reranking.");
    }

    const topN = options?.topN ?? 5;
    const startTime = performance.now();

    // Emit observer event: Reranking started
    if (this.observerSubject) {
      this.observerSubject.notifyObservers({
        type: "phase:started",
        event: {
          id: `evt_rerank_start_${Date.now()}`,
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "relevance_evaluation_started",
          label: `Cross-Encoder reranking started (${candidateChunks.length} candidates)`,
          status: "running",
          details: {
            model: this.provider.model,
            candidateCount: candidateChunks.length,
            topN,
          },
        },
      });
    }

    // Handle empty candidate pool cleanly
    if (!candidateChunks || candidateChunks.length === 0) {
      const emptyMetrics: RelevanceEvaluationMetrics = {
        candidateCount: 0,
        evaluationLatencyMs: 0,
        averageCandidateLatencyMs: 0,
        totalLatencyMs: 0,
        isColdStart: false,
      };

      return {
        id: `rerank_${Date.now()}_empty`,
        query,
        originalPoolId: pool.id,
        retrievedAt: pool.retrievedAt,
        rerankedAt: Date.now(),
        crossEncoderModel: this.provider.model,
        embeddingModel: pool.embeddingModel,
        topKRetrieved: 0,
        topNSelected: 0,
        candidates: [],
        selectedCandidates: [],
        metrics: emptyMetrics,
      };
    }

    // 1. Evaluate all candidates in a single batch call to CrossEncoderProvider
    const candidateTexts = candidateChunks.map((c) => c.text);
    const predictionResult = await this.provider.predictScores(
      query,
      candidateTexts
    );

    // 2. Map original candidate chunks to RerankedCandidateChunk with scores attached
    const enrichedCandidates: RerankedCandidateChunk[] = candidateChunks.map(
      (chunk, index) => {
        const score = predictionResult.scores[index] ?? 0;
        const originalRank = chunk.rank ?? index + 1;
        const originalRetrievalScore = chunk.retrievalScore ?? 0;

        return {
          ...chunk,
          originalRank,
          originalRetrievalScore,
          crossEncoderScore: score,
          rerankedRank: 0, // Assigned below after sort
          rankDelta: 0, // Calculated below
          isSelected: false,
          relevanceScore: score,
        };
      }
    );

    // 3. Sort candidates descending by cross-encoder score
    enrichedCandidates.sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);

    // 4. Assign reranked positions (1-indexed) and Top-N selection
    const selectedCandidates: RerankedCandidateChunk[] = [];

    enrichedCandidates.forEach((item, index) => {
      const rerankedRank = index + 1;
      const isSelected = rerankedRank <= topN;

      item.rerankedRank = rerankedRank;
      item.rank = rerankedRank;
      item.rankDelta = item.originalRank - rerankedRank;
      item.isSelected = isSelected;
      item.decision = isSelected ? "retained" : "discarded";

      if (isSelected) {
        selectedCandidates.push(item);
      }
    });

    const totalDuration = performance.now() - startTime;
    const avgCandidateLatency =
      predictionResult.evaluationLatencyMs / Math.max(1, candidateChunks.length);

    const metrics: RelevanceEvaluationMetrics = {
      candidateCount: candidateChunks.length,
      modelLoadLatencyMs: predictionResult.modelLoadLatencyMs,
      evaluationLatencyMs: predictionResult.evaluationLatencyMs,
      averageCandidateLatencyMs: Number(avgCandidateLatency.toFixed(2)),
      totalLatencyMs: Number(totalDuration.toFixed(2)),
      isColdStart: predictionResult.isColdStart,
    };

    const rerankedPool: RerankedCandidatePool = {
      id: `rerank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      query,
      originalPoolId: pool.id,
      retrievedAt: pool.retrievedAt,
      rerankedAt: Date.now(),
      crossEncoderModel: this.provider.model,
      embeddingModel: pool.embeddingModel,
      topKRetrieved: candidateChunks.length,
      topNSelected: selectedCandidates.length,
      candidates: enrichedCandidates,
      selectedCandidates,
      metrics,
    };

    // Emit observer event: Reranking completed
    if (this.observerSubject) {
      this.observerSubject.notifyObservers({
        type: "phase:completed",
        event: {
          id: `evt_rerank_done_${Date.now()}`,
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "relevance_evaluation_completed",
          label: `Cross-Encoder reranked ${candidateChunks.length} candidates, selected Top-${selectedCandidates.length}`,
          status: "success",
          durationMs: metrics.evaluationLatencyMs,
          details: {
            topN,
            candidateCount: candidateChunks.length,
            model: this.provider.model,
          },
        },
      });
    }

    return rerankedPool;
  }
}
