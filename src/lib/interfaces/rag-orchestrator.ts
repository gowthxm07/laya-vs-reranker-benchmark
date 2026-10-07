import { Experiment, PipelineResult, PipelineId } from "../types/experiment";
import { DocumentDataset } from "../types/dataset";
import { RelevanceEvaluator } from "./relevance-evaluator";
import { LLMProvider } from "./llm-provider";

/**
 * Execution parameters for running a comparison benchmark
 */
export interface RunBenchmarkRequest {
  query: string;
  dataset: DocumentDataset;
  topKRetrieved?: number;
  topKRetained?: number;
}

/**
 * [FACADE PATTERN CONTRACT]
 * High-level orchestration boundary encapsulating the complete multi-step RAG workflow:
 * Retrieval -> Relevance Evaluation -> Context Assembly -> LLM Answer Generation -> Evaluation Metrics.
 *
 * Provides a clean unified interface to the UI and API layer without exposing the complex
 * underlying subsystems (retriever, vector DB, cross-encoders, Laya adapters, builders, LLMs).
 */
export interface IRAGOrchestratorFacade {
  /**
   * Executes a single pipeline path using the specified relevance evaluator strategy
   */
  executePipeline(
    pipelineId: PipelineId,
    query: string,
    dataset: DocumentDataset,
    evaluator: RelevanceEvaluator,
    llmProvider: LLMProvider
  ): Promise<PipelineResult>;

  /**
   * Runs the complete comparative benchmark across both Path A (Advanced RAG)
   * and Path B (Laya RAG) on identical candidate chunks.
   */
  runComparisonBenchmark(request: RunBenchmarkRequest): Promise<Experiment>;
}
