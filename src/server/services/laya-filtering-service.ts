import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import {
  LayaFilteredPool,
  LayaEvaluationMetrics,
} from "@/lib/types/laya";
import { LayaProvider } from "@/lib/interfaces/laya-provider";
import { LayaProviderFactory } from "@/lib/providers/laya-provider-factory";
import { LayaAdapter } from "@/lib/adapters/laya-adapter";
import { IObservablePipeline } from "@/lib/interfaces/observer";

export interface LayaFilteringOptions {
  /** Optional score threshold or tuning parameters */
  threshold?: number;
}

/**
 * [LAYA RELEVANCE FILTERING SERVICE]
 * Coordinates post-retrieval Laya relevance evaluation and semantic pruning (Path B).
 * Consumes the shared CandidateChunkPool and produces a LayaFilteredPool without re-retrieving.
 */
export class LayaRelevanceFilteringService {
  private adapter: LayaAdapter;
  private provider: LayaProvider;
  private observerSubject?: IObservablePipeline;

  constructor(
    providerOrAdapter?: LayaProvider | LayaAdapter,
    observerSubject?: IObservablePipeline
  ) {
    if (providerOrAdapter && "filterCandidates" in providerOrAdapter) {
      this.adapter = providerOrAdapter;
      // Resolve provider from factory if not directly exposed
      this.provider = LayaProviderFactory.getProvider();
    } else if (providerOrAdapter) {
      this.provider = providerOrAdapter as LayaProvider;
      this.adapter = new LayaAdapter(this.provider);
    } else {
      this.provider = LayaProviderFactory.getProvider();
      this.adapter = new LayaAdapter(this.provider);
    }
    this.observerSubject = observerSubject;
  }

  /**
   * Evaluates all candidates in a CandidateChunkPool using Laya's non-autoregressive decision model.
   * Produces binary KEEP/DROP gating decisions, preserves candidate lineage, and computes reduction metrics.
   */
  async filterPool(
    pool: CandidateChunkPool,
    options?: LayaFilteringOptions
  ): Promise<LayaFilteredPool> {
    if (!pool) {
      throw new Error("CandidateChunkPool cannot be null or undefined.");
    }

    const { query, candidateChunks } = pool;
    if (!query || !query.trim()) {
      throw new Error("Query cannot be empty for Laya relevance filtering.");
    }

    const startTime = performance.now();

    // Emit observer event: Relevance evaluation started
    if (this.observerSubject) {
      this.observerSubject.notifyObservers({
        type: "phase:started",
        event: {
          id: `evt_laya_start_${Date.now()}`,
          timestamp: Date.now(),
          pipelineId: "laya-rag",
          phase: "relevance_evaluation_started",
          label: `Laya relevance filtering started (${candidateChunks.length} candidates)`,
          status: "running",
          details: {
            model: this.provider.model,
            candidateCount: candidateChunks.length,
          },
        },
      });
    }

    // Handle empty candidate pool cleanly
    if (!candidateChunks || candidateChunks.length === 0) {
      const emptyMetrics: LayaEvaluationMetrics = {
        candidateCount: 0,
        retainedCount: 0,
        discardedCount: 0,
        contextReductionPercent: 0,
        evaluationLatencyMs: 0,
        averageCandidateLatencyMs: 0,
        totalLatencyMs: 0,
        isColdStart: false,
      };

      return {
        id: `laya_pool_${Date.now()}_empty`,
        query,
        originalPoolId: pool.id,
        retrievedAt: pool.retrievedAt,
        evaluatedAt: Date.now(),
        layaModel: this.provider.model,
        embeddingModel: pool.embeddingModel,
        totalCandidates: 0,
        retainedCount: 0,
        discardedCount: 0,
        contextReductionPercent: 0,
        candidates: [],
        retainedCandidates: [],
        discardedCandidates: [],
        metrics: emptyMetrics,
        filteringThreshold: options?.threshold,
      };
    }

    // 1. Evaluate all candidates via adapter
    const filterResult = await this.adapter.filterCandidates(
      query,
      candidateChunks,
      options
    );

    const totalDuration = performance.now() - startTime;
    const candidateCount = candidateChunks.length;
    const retainedCount = filterResult.retainedChunks.length;
    const discardedCount = filterResult.discardedChunks.length;

    // 2. Compute context reduction percentage: ((candidateCount - retainedCount) / candidateCount) * 100
    const contextReductionPercent = Number(
      (
        ((candidateCount - retainedCount) / Math.max(1, candidateCount)) *
        100
      ).toFixed(1)
    );

    const avgLatency =
      filterResult.adapterLatencyMs / Math.max(1, candidateCount);

    const metrics: LayaEvaluationMetrics = {
      candidateCount,
      retainedCount,
      discardedCount,
      contextReductionPercent,
      evaluationLatencyMs: filterResult.adapterLatencyMs,
      averageCandidateLatencyMs: Number(avgLatency.toFixed(2)),
      totalLatencyMs: Number(totalDuration.toFixed(2)),
      modelLoadLatencyMs: filterResult.modelLoadLatencyMs,
      isColdStart: filterResult.isColdStart,
    };

    const layaFilteredPool: LayaFilteredPool = {
      id: `laya_pool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      query,
      originalPoolId: pool.id,
      retrievedAt: pool.retrievedAt,
      evaluatedAt: Date.now(),
      layaModel: filterResult.layaModel,
      embeddingModel: pool.embeddingModel,
      totalCandidates: candidateCount,
      retainedCount,
      discardedCount,
      contextReductionPercent,
      candidates: filterResult.allCandidates,
      retainedCandidates: filterResult.retainedChunks,
      discardedCandidates: filterResult.discardedChunks,
      metrics,
      filteringThreshold: options?.threshold,
    };

    // Emit observer event: Relevance evaluation completed
    if (this.observerSubject) {
      this.observerSubject.notifyObservers({
        type: "phase:completed",
        event: {
          id: `evt_laya_done_${Date.now()}`,
          timestamp: Date.now(),
          pipelineId: "laya-rag",
          phase: "relevance_evaluation_completed",
          label: `Laya evaluated ${candidateCount} candidates in ${metrics.evaluationLatencyMs}ms (retained ${retainedCount}, dropped ${discardedCount})`,
          status: "success",
          durationMs: metrics.evaluationLatencyMs,
          details: {
            candidateCount,
            retainedCount,
            discardedCount,
            contextReductionPercent,
            model: filterResult.layaModel,
            isColdStart: filterResult.isColdStart,
          },
        },
      });

      this.observerSubject.notifyObservers({
        type: "phase:completed",
        event: {
          id: `evt_laya_filter_${Date.now()}`,
          timestamp: Date.now() + 1,
          pipelineId: "laya-rag",
          phase: "chunks_filtered",
          label: `Laya semantic pruning achieved ${contextReductionPercent}% candidate context reduction`,
          status: "success",
          details: {
            candidateCount,
            retainedCount,
            discardedCount,
            contextReductionPercent,
          },
        },
      });
    }

    return layaFilteredPool;
  }
}
