import {
  IRAGOrchestratorFacade,
  RunBenchmarkRequest,
} from "../../interfaces/rag-orchestrator";
import { RelevanceEvaluator } from "../../interfaces/relevance-evaluator";
import { LLMProvider } from "../../interfaces/llm-provider";
import {
  Experiment,
  PipelineResult,
  PipelineId,
} from "../../types/experiment";
import { DocumentDataset } from "../../types/dataset";
import { ObservablePipelineSubject } from "../observer/pipeline-observer";

/**
 * [FACADE PATTERN IMPLEMENTATION]
 * High-level orchestration facade encapsulating the multi-step RAG benchmark workflow.
 *
 * In Phase 1, the facade establishes the coordination contract and boundaries between:
 * 1. Retrieval
 * 2. Relevance Evaluation (Strategy pattern)
 * 3. Context & Prompt Construction (Builder pattern)
 * 4. Downstream Generation (LLMProvider contract)
 * 5. Lifecycle Telemetry (Observer pattern)
 */
export class RAGOrchestratorFacade implements IRAGOrchestratorFacade {
  protected pipelineObservable: ObservablePipelineSubject;

  constructor() {
    this.pipelineObservable = new ObservablePipelineSubject();
  }

  /**
   * Access to pipeline lifecycle observer registry
   */
  public getObservable(): ObservablePipelineSubject {
    return this.pipelineObservable;
  }

  /**
   * Executes a single pipeline path (Contract stub for Phase 2/3)
   */
  async executePipeline(
    pipelineId: PipelineId,
    query: string,
    dataset: DocumentDataset,
    evaluator: RelevanceEvaluator,
    _llmProvider: LLMProvider
  ): Promise<PipelineResult> {
    throw new Error(
      `Pipeline execution for "${pipelineId}" using strategy "${evaluator.name}" is planned for Phase 2/3. ` +
        `Dataset: ${dataset.name}, Query: "${query}".`
    );
  }

  /**
   * Runs the dual-path comparative benchmark across Path A (Advanced RAG)
   * and Path B (Laya RAG) on identical candidate chunks (Contract stub for Phase 4)
   */
  async runComparisonBenchmark(
    request: RunBenchmarkRequest
  ): Promise<Experiment> {
    throw new Error(
      `Dual-pipeline comparison benchmark execution is planned for Phase 4. ` +
        `Target dataset: "${request.dataset.name}", Query: "${request.query}".`
    );
  }
}
