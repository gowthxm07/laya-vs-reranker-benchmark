import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { Chunk } from "@/lib/types/chunk";
import {
  ComparisonMode,
  ComparisonOptions,
  ComparisonResult,
  PathComparisonResult,
} from "@/lib/types/comparison";
import { RerankedCandidatePool } from "@/lib/types/reranker";
import { LayaFilteredPool } from "@/lib/types/laya";
import { LLMProvider } from "@/lib/interfaces/llm-provider";
import { LLMProviderFactory } from "@/lib/providers/llm-provider-factory";
import { CrossEncoderRerankingService } from "./cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "./laya-filtering-service";
import { ContextBuilder } from "@/lib/patterns/builder/context-builder";
import { PromptBuilder } from "@/lib/patterns/builder/prompt-builder";
import {
  ObservablePipelineSubject,
  TraceRecorderObserver,
} from "@/lib/patterns/observer/pipeline-observer";

export interface RAGComparisonOrchestratorConfig {
  crossEncoderService?: CrossEncoderRerankingService;
  layaService?: LayaRelevanceFilteringService;
  llmProvider?: LLMProvider;
  observable?: ObservablePipelineSubject;
}

/**
 * [RAG COMPARISON ORCHESTRATOR]
 * Orchestrates controlled head-to-head comparisons between Advanced RAG (Cross-Encoder)
 * and Laya RAG (Relevance Filter) against the EXACT SAME candidate pool and DOWNSTREAM LLM.
 *
 * Strict Experimental Controls:
 * 1. Single CandidateChunkPool: Both strategies receive the identical immutable candidate pool.
 * 2. Single LLM Instance: Both paths generate answers with the same Ollama llama3.2:3b model.
 * 3. Identical Generation Prompt: Both paths use the exact same system & user prompt templates.
 * 4. Identical Generation Parameters: Both paths run with identical options (temperature=0, seed=42).
 * 5. Sequential Execution: Runs sequentially to isolate CPU/RAM contention and prevent latency distortion.
 */
export class RAGComparisonOrchestrator {
  private crossEncoderService: CrossEncoderRerankingService;
  private layaService: LayaRelevanceFilteringService;
  private llmProvider: LLMProvider;
  private observable: ObservablePipelineSubject;
  private traceRecorder: TraceRecorderObserver;

  constructor(config?: RAGComparisonOrchestratorConfig) {
    this.observable = config?.observable || new ObservablePipelineSubject();
    this.traceRecorder = new TraceRecorderObserver();
    this.observable.addObserver(this.traceRecorder);

    this.crossEncoderService =
      config?.crossEncoderService ||
      new CrossEncoderRerankingService(undefined, this.observable);
    this.layaService =
      config?.layaService ||
      new LayaRelevanceFilteringService(undefined, this.observable);
    this.llmProvider =
      config?.llmProvider || LLMProviderFactory.getProvider();
  }

  public getObservable(): ObservablePipelineSubject {
    return this.observable;
  }

  public getLLMProvider(): LLMProvider {
    return this.llmProvider;
  }

  /**
   * Executes a controlled comparison on the given CandidateChunkPool.
   */
  async compareCandidatePool(
    pool: CandidateChunkPool,
    options?: ComparisonOptions
  ): Promise<ComparisonResult> {
    if (!pool) {
      throw new Error("CandidateChunkPool cannot be null or undefined.");
    }

    const { query, candidateChunks } = pool;
    if (!query || !query.trim()) {
      throw new Error("Query cannot be empty for comparison benchmark.");
    }

    const runId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const overallStartTime = performance.now();
    const mode: ComparisonMode = options?.mode || "native";
    const topN = options?.topN ?? 5;
    const maxContextChunks = options?.maxContextChunks ?? 5;

    const generationParameters = {
      temperature: 0,
      seed: 42,
      ...(options?.generationOptions || {}),
    };

    // Notify Observer: Comparison started
    this.observable.notifyObservers({
      type: "phase:started",
      event: {
        id: `evt_comp_start_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "chunks_retrieved",
        label: `Comparison run started [Mode: ${mode}]`,
        status: "running",
        details: {
          query,
          candidateCount: candidateChunks.length,
          mode,
          topN,
          maxContextChunks,
        },
      },
    });

    // ------------------------------------------------------------------------
    // STAGE 2: EVALUATING PASSAGES WITH CROSS-ENCODER
    // ------------------------------------------------------------------------
    this.observable.notifyObservers({
      type: "phase:started",
      event: {
        id: `evt_ce_start_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "relevance_evaluation_started",
        label: `Evaluating passages with Cross-Encoder (${candidateChunks.length} candidates)`,
        status: "running",
        details: { stageId: "cross-encoder-eval", stageNumber: 2 },
      },
    });

    let rerankedPool: RerankedCandidatePool | null = null;
    let ceEvalError: string | null = null;
    let ceEvalLatencyMs = 0;

    try {
      const ceStart = performance.now();
      rerankedPool = await this.crossEncoderService.rerankPool(pool, { topN });
      ceEvalLatencyMs =
        rerankedPool.metrics.evaluationLatencyMs ||
        Math.round(performance.now() - ceStart);

      this.observable.notifyObservers({
        type: "phase:completed",
        event: {
          id: `evt_ce_end_${runId}`,
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "relevance_evaluation_completed",
          label: `Cross-Encoder evaluation completed in ${ceEvalLatencyMs}ms`,
          status: "success",
          durationMs: ceEvalLatencyMs,
          details: { stageId: "cross-encoder-eval", stageNumber: 2 },
        },
      });
    } catch (err: unknown) {
      ceEvalError = err instanceof Error ? err.message : String(err);
      this.observable.notifyObservers({
        type: "phase:failed",
        event: {
          id: `evt_ce_fail_${runId}`,
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "relevance_evaluation_completed",
          label: `Cross-Encoder evaluation failed: ${ceEvalError}`,
          status: "error",
          errorMessage: ceEvalError,
          details: { stageId: "cross-encoder-eval" },
        },
      });
    }

    // ------------------------------------------------------------------------
    // STAGE 3: EVALUATING PASSAGES WITH LAYA
    // ------------------------------------------------------------------------
    this.observable.notifyObservers({
      type: "phase:started",
      event: {
        id: `evt_laya_start_${runId}`,
        timestamp: Date.now(),
        pipelineId: "laya-rag",
        phase: "relevance_evaluation_started",
        label: `Evaluating passages with Laya (${candidateChunks.length} candidates)`,
        status: "running",
        details: { stageId: "laya-eval", stageNumber: 3 },
      },
    });

    let filteredPool: LayaFilteredPool | null = null;
    let layaEvalError: string | null = null;
    let layaEvalLatencyMs = 0;

    try {
      const layaStart = performance.now();
      filteredPool = await this.layaService.filterPool(pool, {
        threshold: options?.layaThreshold,
      });
      layaEvalLatencyMs =
        filteredPool.metrics.evaluationLatencyMs ||
        Math.round(performance.now() - layaStart);

      this.observable.notifyObservers({
        type: "phase:completed",
        event: {
          id: `evt_laya_end_${runId}`,
          timestamp: Date.now(),
          pipelineId: "laya-rag",
          phase: "relevance_evaluation_completed",
          label: `Laya evaluation completed in ${layaEvalLatencyMs}ms`,
          status: "success",
          durationMs: layaEvalLatencyMs,
          details: { stageId: "laya-eval", stageNumber: 3 },
        },
      });
    } catch (err: unknown) {
      layaEvalError = err instanceof Error ? err.message : String(err);
      this.observable.notifyObservers({
        type: "phase:failed",
        event: {
          id: `evt_laya_fail_${runId}`,
          timestamp: Date.now(),
          pipelineId: "laya-rag",
          phase: "relevance_evaluation_completed",
          label: `Laya evaluation failed: ${layaEvalError}`,
          status: "error",
          errorMessage: layaEvalError,
          details: { stageId: "laya-eval" },
        },
      });
    }

    // ------------------------------------------------------------------------
    // STAGE 4: PREPARING CONTEXT FOR BOTH STRATEGIES
    // ------------------------------------------------------------------------
    this.observable.notifyObservers({
      type: "phase:started",
      event: {
        id: `evt_context_start_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "context_built",
        label: "Preparing context for both strategies",
        status: "running",
        details: { stageId: "context-prep" },
      },
    });

    const contextBuildStart = performance.now();

    // Path A context
    let selectedChunksA: Chunk[] = [];
    let discardedCountA = pool.candidateChunks.length;
    let contextTextA = "";
    let contextCharCountA = 0;
    let contextTokenCountA = 0;

    if (rerankedPool) {
      if (mode === "context-budget") {
        const budget = Math.min(topN, maxContextChunks);
        selectedChunksA = rerankedPool.selectedCandidates.slice(0, budget);
      } else {
        selectedChunksA = rerankedPool.selectedCandidates;
      }
      discardedCountA = pool.candidateChunks.length - selectedChunksA.length;
      if (selectedChunksA.length > 0) {
        const cbA = ContextBuilder.createBenchmarkBuilder();
        cbA.addChunks(selectedChunksA);
        contextTextA = cbA.build();
        contextCharCountA = contextTextA.length;
        contextTokenCountA = await this.llmProvider.estimateTokenCount(
          contextTextA
        );
      }
    }

    // Path B context
    let selectedChunksB: Chunk[] = [];
    let discardedCountB = pool.candidateChunks.length;
    let contextTextB = "";
    let contextCharCountB = 0;
    let contextTokenCountB = 0;

    if (filteredPool) {
      if (mode === "context-budget") {
        if (filteredPool.retainedCandidates.length > maxContextChunks) {
          selectedChunksB = filteredPool.retainedCandidates.slice(
            0,
            maxContextChunks
          );
        } else {
          selectedChunksB = filteredPool.retainedCandidates;
        }
      } else {
        selectedChunksB = filteredPool.retainedCandidates;
      }
      discardedCountB = pool.candidateChunks.length - selectedChunksB.length;
      if (selectedChunksB.length > 0) {
        const cbB = ContextBuilder.createBenchmarkBuilder();
        cbB.addChunks(selectedChunksB);
        contextTextB = cbB.build();
        contextCharCountB = contextTextB.length;
        contextTokenCountB = await this.llmProvider.estimateTokenCount(
          contextTextB
        );
      }
    }

    const contextBuildLatencyMs = Math.round(
      performance.now() - contextBuildStart
    );

    this.observable.notifyObservers({
      type: "phase:completed",
      event: {
        id: `evt_context_end_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "context_built",
        label: "Context prepared for both strategies",
        status: "success",
        durationMs: contextBuildLatencyMs,
        details: { stageId: "context-prep" },
      },
    });

    // ------------------------------------------------------------------------
    // STAGE 5: GENERATING CROSS-ENCODER ANSWER
    // ------------------------------------------------------------------------
    let pathAResult: PathComparisonResult;
    if (ceEvalError) {
      pathAResult = this.createFailedPathResult(
        "advanced-rag",
        "Cross-Encoder Reranker",
        "cross-encoder",
        ceEvalError
      );
    } else {
      this.observable.notifyObservers({
        type: "phase:started",
        event: {
          id: `evt_gen_a_start_${runId}`,
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "generation_started",
          label: `Path A LLM answer generation started [${this.llmProvider.model}]`,
          status: "running",
          details: { stageId: "cross-encoder-gen" },
        },
      });

      try {
        const promptPayloadA = PromptBuilder.createBenchmarkPrompt(
          query,
          contextTextA
        );
        const genResultA = await this.llmProvider.generateAnswer(
          promptPayloadA,
          generationParameters
        );

        this.observable.notifyObservers({
          type: "phase:completed",
          event: {
            id: `evt_gen_a_end_${runId}`,
            timestamp: Date.now(),
            pipelineId: "advanced-rag",
            phase: "generation_completed",
            label: `Path A LLM answer generated in ${genResultA.latencyMs}ms`,
            status: "success",
            durationMs: genResultA.latencyMs,
            details: { stageId: "cross-encoder-gen" },
          },
        });

        pathAResult = {
          pipelineId: "advanced-rag",
          strategyName: `Cross-Encoder (${rerankedPool?.crossEncoderModel || "ms-marco-MiniLM-L-6-v2"})`,
          strategyId: "cross-encoder",
          selectedChunkIds: selectedChunksA.map((c) => c.id),
          selectedChunks: selectedChunksA,
          retainedCount: selectedChunksA.length,
          discardedCount: discardedCountA,
          contextText: contextTextA,
          contextCharacterCount: contextCharCountA,
          contextTokenCount: contextTokenCountA,
          isTokenCountEstimated: genResultA.isTokenCountEstimated ?? false,
          relevanceLatencyMs: ceEvalLatencyMs,
          contextBuildLatencyMs,
          generationLatencyMs: genResultA.latencyMs,
          totalLatencyMs:
            ceEvalLatencyMs + contextBuildLatencyMs + genResultA.latencyMs,
          answer: genResultA.answerText,
          promptTokens: genResultA.promptTokens,
          completionTokens: genResultA.completionTokens,
          totalTokens: genResultA.totalTokens,
          metadata: {
            rawRerankedCount: rerankedPool?.selectedCandidates.length || 0,
            rerankScores: (rerankedPool?.selectedCandidates || []).map((c) => ({
              id: c.id,
              rerankScore: c.crossEncoderScore,
              rerankedRank: c.rerankedRank,
            })),
          },
        };
      } catch (err: unknown) {
        const genErrMsg = err instanceof Error ? err.message : String(err);
        pathAResult = this.createFailedPathResult(
          "advanced-rag",
          "Cross-Encoder Reranker",
          "cross-encoder",
          genErrMsg
        );
      }
    }

    // ------------------------------------------------------------------------
    // STAGE 6: GENERATING LAYA ANSWER
    // ------------------------------------------------------------------------
    let pathBResult: PathComparisonResult;
    if (layaEvalError) {
      pathBResult = this.createFailedPathResult(
        "laya-rag",
        "Laya Relevance Filter",
        "laya",
        layaEvalError
      );
    } else {
      this.observable.notifyObservers({
        type: "phase:started",
        event: {
          id: `evt_gen_b_start_${runId}`,
          timestamp: Date.now(),
          pipelineId: "laya-rag",
          phase: "generation_started",
          label: `Path B LLM answer generation started [${this.llmProvider.model}]`,
          status: "running",
          details: { stageId: "laya-gen" },
        },
      });

      try {
        const promptPayloadB = PromptBuilder.createBenchmarkPrompt(
          query,
          contextTextB
        );
        const genResultB = await this.llmProvider.generateAnswer(
          promptPayloadB,
          generationParameters
        );

        this.observable.notifyObservers({
          type: "phase:completed",
          event: {
            id: `evt_gen_b_end_${runId}`,
            timestamp: Date.now(),
            pipelineId: "laya-rag",
            phase: "generation_completed",
            label: `Path B LLM answer generated in ${genResultB.latencyMs}ms`,
            status: "success",
            durationMs: genResultB.latencyMs,
            details: { stageId: "laya-gen" },
          },
        });

        const isStrict =
          typeof options?.layaThreshold === "number" &&
          options.layaThreshold > 0.5;
        const strategyName = isStrict
          ? `Laya Relevance Filter (${filteredPool?.layaModel || "laya"}, strict \u03c4=${options.layaThreshold})`
          : `Laya Relevance Filter (${filteredPool?.layaModel || "laya"})`;

        pathBResult = {
          pipelineId: "laya-rag",
          strategyName,
          strategyId: "laya",
          selectedChunkIds: selectedChunksB.map((c) => c.id),
          selectedChunks: selectedChunksB,
          retainedCount: selectedChunksB.length,
          discardedCount: discardedCountB,
          contextText: contextTextB,
          contextCharacterCount: contextCharCountB,
          contextTokenCount: contextTokenCountB,
          isTokenCountEstimated: genResultB.isTokenCountEstimated ?? false,
          relevanceLatencyMs: layaEvalLatencyMs,
          contextBuildLatencyMs,
          generationLatencyMs: genResultB.latencyMs,
          totalLatencyMs:
            layaEvalLatencyMs + contextBuildLatencyMs + genResultB.latencyMs,
          answer: genResultB.answerText,
          promptTokens: genResultB.promptTokens,
          completionTokens: genResultB.completionTokens,
          totalTokens: genResultB.totalTokens,
          filteringThreshold: options?.layaThreshold,
          metadata: {
            rawKeepCount: filteredPool?.retainedCandidates.length || 0,
            rawDropCount: filteredPool?.discardedCandidates.length || 0,
            contextReductionPercent:
              filteredPool?.metrics.contextReductionPercent || 0,
            filteringThreshold: options?.layaThreshold,
            evaluatedCandidates: filteredPool?.candidates || [],
          },
        };
      } catch (err: unknown) {
        const genErrMsg = err instanceof Error ? err.message : String(err);
        pathBResult = this.createFailedPathResult(
          "laya-rag",
          "Laya Relevance Filter",
          "laya",
          genErrMsg
        );
      }
    }

    // ------------------------------------------------------------------------
    // STAGE 7: FINALIZING COMPARISON RESULTS
    // ------------------------------------------------------------------------
    const overallLatencyMs = Math.round(performance.now() - overallStartTime);

    this.observable.notifyObservers({
      type: "phase:completed",
      event: {
        id: `evt_metrics_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "metrics_calculated",
        label: "Finalizing comparison results",
        status: "success",
        durationMs: overallLatencyMs,
        details: { stageId: "finalizing" },
      },
    });

    this.observable.notifyObservers({
      type: "phase:completed",
      event: {
        id: `evt_comp_end_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "generation_completed",
        label: `Comparison run completed in ${overallLatencyMs}ms`,
        status: "success",
        durationMs: overallLatencyMs,
        details: {
          pathALatencyMs: pathAResult.totalLatencyMs,
          pathBLatencyMs: pathBResult.totalLatencyMs,
          pathARetained: pathAResult.retainedCount,
          pathBRetained: pathBResult.retainedCount,
          stageId: "finalizing",
        },
      },
    });

    return {
      id: runId,
      query,
      timestamp: Date.now(),
      mode,
      topN,
      maxContextChunks: mode === "context-budget" ? maxContextChunks : undefined,
      sharedRetrieval: {
        candidateCount: candidateChunks.length,
        retrievalLatencyMs: pool.retrievalLatencyMs || 0,
        candidatePool: pool,
      },
      crossEncoder: pathAResult,
      laya: pathBResult,
      overallLatencyMs,
      trace: this.traceRecorder.getEvents(),
      llmModel: this.llmProvider.model,
      llmProvider: this.llmProvider.id,
      generationParameters,
    };
  }

  private createFailedPathResult(
    pipelineId: "advanced-rag" | "laya-rag",
    strategyName: string,
    strategyId: string,
    error: string
  ): PathComparisonResult {
    return {
      pipelineId,
      strategyName,
      strategyId,
      selectedChunkIds: [],
      selectedChunks: [],
      retainedCount: 0,
      discardedCount: 0,
      contextText: "",
      contextCharacterCount: 0,
      contextTokenCount: 0,
      isTokenCountEstimated: false,
      relevanceLatencyMs: 0,
      contextBuildLatencyMs: 0,
      generationLatencyMs: 0,
      totalLatencyMs: 0,
      answer: `Generation failed for this branch: ${error}`,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      error,
    };
  }
}
