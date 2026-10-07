import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { Chunk } from "@/lib/types/chunk";
import {
  ComparisonMode,
  ComparisonOptions,
  ComparisonResult,
  PathComparisonResult,
} from "@/lib/types/comparison";
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
    // PATH A: ADVANCED RAG (CROSS-ENCODER RERANKING)
    // ------------------------------------------------------------------------
    let pathAResult: PathComparisonResult;
    try {
      pathAResult = await this.executePathA(
        pool,
        mode,
        topN,
        maxContextChunks,
        generationParameters,
        runId
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      pathAResult = this.createFailedPathResult(
        "advanced-rag",
        "Cross-Encoder Reranker",
        "cross-encoder",
        errMsg
      );
    }

    // ------------------------------------------------------------------------
    // PATH B: LAYA RAG (NON-AUTOREGRESSIVE RELEVANCE FILTERING)
    // ------------------------------------------------------------------------
    let pathBResult: PathComparisonResult;
    try {
      pathBResult = await this.executePathB(
        pool,
        mode,
        maxContextChunks,
        generationParameters,
        runId
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      pathBResult = this.createFailedPathResult(
        "laya-rag",
        "Laya Relevance Filter",
        "laya",
        errMsg
      );
    }

    const overallLatencyMs = Math.round(performance.now() - overallStartTime);

    // Notify Observer: Comparison completed
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

  /**
   * Executes Path A (Cross-Encoder):
   * CandidateChunkPool -> Cross-Encoder -> Reranked Pool -> Selected Chunks -> ContextBuilder -> LLM
   */
  private async executePathA(
    pool: CandidateChunkPool,
    mode: ComparisonMode,
    topN: number,
    maxContextChunks: number,
    generationParameters: Record<string, unknown>,
    runId: string
  ): Promise<PathComparisonResult> {
    const startTime = performance.now();

    // 1. Cross-Encoder Relevance Reranking
    const rerankedPool = await this.crossEncoderService.rerankPool(pool, {
      topN,
    });
    const relevanceLatencyMs = rerankedPool.metrics.evaluationLatencyMs;

    // 2. Selection according to Mode
    let selectedChunks: Chunk[];
    if (mode === "context-budget") {
      const budget = Math.min(topN, maxContextChunks);
      selectedChunks = rerankedPool.selectedCandidates.slice(0, budget);
    } else {
      // Native mode: topN reranked chunks
      selectedChunks = rerankedPool.selectedCandidates;
    }

    const discardedCount = pool.candidateChunks.length - selectedChunks.length;

    // 3. Context Construction
    const contextBuildStart = performance.now();
    let contextText = "";
    if (selectedChunks.length > 0) {
      const contextBuilder = ContextBuilder.createBenchmarkBuilder();
      contextBuilder.addChunks(selectedChunks);
      contextText = contextBuilder.build();
    }
    const contextBuildLatencyMs = Math.round(
      performance.now() - contextBuildStart
    );

    const contextCharCount = contextText.length;
    const contextTokenCount =
      selectedChunks.length > 0
        ? await this.llmProvider.estimateTokenCount(contextText)
        : 0;

    // 4. Downstream LLM Generation with Shared Prompt
    this.observable.notifyObservers({
      type: "phase:started",
      event: {
        id: `evt_gen_a_start_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "generation_started",
        label: `Path A LLM answer generation started [${this.llmProvider.model}]`,
        status: "running",
      },
    });

    const promptPayload = PromptBuilder.createBenchmarkPrompt(
      pool.query,
      contextText
    );

    const genResult = await this.llmProvider.generateAnswer(
      promptPayload,
      generationParameters
    );

    const totalLatencyMs = Math.max(
      relevanceLatencyMs + contextBuildLatencyMs + genResult.latencyMs,
      Math.round(performance.now() - startTime)
    );

    this.observable.notifyObservers({
      type: "phase:completed",
      event: {
        id: `evt_gen_a_end_${runId}`,
        timestamp: Date.now(),
        pipelineId: "advanced-rag",
        phase: "generation_completed",
        label: `Path A LLM answer generated in ${genResult.latencyMs}ms`,
        status: "success",
        durationMs: genResult.latencyMs,
      },
    });

    return {
      pipelineId: "advanced-rag",
      strategyName: `Cross-Encoder (${rerankedPool.crossEncoderModel})`,
      strategyId: "cross-encoder",
      selectedChunkIds: selectedChunks.map((c) => c.id),
      selectedChunks,
      retainedCount: selectedChunks.length,
      discardedCount,
      contextText,
      contextCharacterCount: contextCharCount,
      contextTokenCount,
      isTokenCountEstimated: genResult.isTokenCountEstimated ?? false,
      relevanceLatencyMs,
      contextBuildLatencyMs,
      generationLatencyMs: genResult.latencyMs,
      totalLatencyMs,
      answer: genResult.answerText,
      promptTokens: genResult.promptTokens,
      completionTokens: genResult.completionTokens,
      totalTokens: genResult.totalTokens,
      metadata: {
        rawRerankedCount: rerankedPool.selectedCandidates.length,
        rerankScores: rerankedPool.selectedCandidates.map((c) => ({
          id: c.id,
          rerankScore: c.crossEncoderScore,
          rerankedRank: c.rerankedRank,
        })),
      },
    };
  }

  /**
   * Executes Path B (Laya):
   * CandidateChunkPool -> Laya Evaluator -> Filtered Pool -> Selected Chunks -> ContextBuilder -> LLM
   */
  private async executePathB(
    pool: CandidateChunkPool,
    mode: ComparisonMode,
    maxContextChunks: number,
    generationParameters: Record<string, unknown>,
    runId: string
  ): Promise<PathComparisonResult> {
    const startTime = performance.now();

    // 1. Laya Relevance Evaluation & Binary Gating
    const filteredPool = await this.layaService.filterPool(pool, {});
    const relevanceLatencyMs = filteredPool.metrics.evaluationLatencyMs;

    // 2. Selection according to Mode
    let selectedChunks: Chunk[];
    if (mode === "context-budget") {
      // Deterministic policy: Preserve original retrieval order among KEEP candidates and take the first N
      if (filteredPool.retainedCandidates.length > maxContextChunks) {
        selectedChunks = filteredPool.retainedCandidates.slice(
          0,
          maxContextChunks
        );
      } else {
        selectedChunks = filteredPool.retainedCandidates;
      }
    } else {
      // Native mode: All KEEP candidates
      selectedChunks = filteredPool.retainedCandidates;
    }

    const discardedCount = pool.candidateChunks.length - selectedChunks.length;

    // 3. Context Construction (Handling Empty Context if 0 KEEP chunks)
    const contextBuildStart = performance.now();
    let contextText = "";
    if (selectedChunks.length > 0) {
      const contextBuilder = ContextBuilder.createBenchmarkBuilder();
      contextBuilder.addChunks(selectedChunks);
      contextText = contextBuilder.build();
    }
    const contextBuildLatencyMs = Math.round(
      performance.now() - contextBuildStart
    );

    const contextCharCount = contextText.length;
    const contextTokenCount =
      selectedChunks.length > 0
        ? await this.llmProvider.estimateTokenCount(contextText)
        : 0;

    // 4. Downstream LLM Generation with Shared Prompt
    this.observable.notifyObservers({
      type: "phase:started",
      event: {
        id: `evt_gen_b_start_${runId}`,
        timestamp: Date.now(),
        pipelineId: "laya-rag",
        phase: "generation_started",
        label: `Path B LLM answer generation started [${this.llmProvider.model}]`,
        status: "running",
      },
    });

    const promptPayload = PromptBuilder.createBenchmarkPrompt(
      pool.query,
      contextText
    );

    const genResult = await this.llmProvider.generateAnswer(
      promptPayload,
      generationParameters
    );

    const totalLatencyMs = Math.max(
      relevanceLatencyMs + contextBuildLatencyMs + genResult.latencyMs,
      Math.round(performance.now() - startTime)
    );

    this.observable.notifyObservers({
      type: "phase:completed",
      event: {
        id: `evt_gen_b_end_${runId}`,
        timestamp: Date.now(),
        pipelineId: "laya-rag",
        phase: "generation_completed",
        label: `Path B LLM answer generated in ${genResult.latencyMs}ms`,
        status: "success",
        durationMs: genResult.latencyMs,
      },
    });

    return {
      pipelineId: "laya-rag",
      strategyName: `Laya Relevance Filter (${filteredPool.layaModel})`,
      strategyId: "laya",
      selectedChunkIds: selectedChunks.map((c) => c.id),
      selectedChunks,
      retainedCount: selectedChunks.length,
      discardedCount,
      contextText,
      contextCharacterCount: contextCharCount,
      contextTokenCount,
      isTokenCountEstimated: genResult.isTokenCountEstimated ?? false,
      relevanceLatencyMs,
      contextBuildLatencyMs,
      generationLatencyMs: genResult.latencyMs,
      totalLatencyMs,
      answer: genResult.answerText,
      promptTokens: genResult.promptTokens,
      completionTokens: genResult.completionTokens,
      totalTokens: genResult.totalTokens,
      metadata: {
        rawKeepCount: filteredPool.retainedCandidates.length,
        rawDropCount: filteredPool.discardedCandidates.length,
        contextReductionPercent: filteredPool.metrics.contextReductionPercent,
      },
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
