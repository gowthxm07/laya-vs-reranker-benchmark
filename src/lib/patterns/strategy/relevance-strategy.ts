import {
  RelevanceEvaluator,
  RelevanceEvaluationRequest,
  RelevanceEvaluationResult,
} from "../../interfaces/relevance-evaluator";

export type EvaluatorStrategyType =
  | "cross-encoder"
  | "laya"
  | "similarity-threshold";

export interface EvaluatorStrategyDescriptor {
  type: EvaluatorStrategyType;
  name: string;
  tagline: string;
  description: string;
  pipelineRole: "Path A (Advanced RAG)" | "Path B (Laya RAG)" | "Baseline";
  isAvailableInPhase1: boolean;
}

export const EVALUATOR_STRATEGIES: Record<
  EvaluatorStrategyType,
  EvaluatorStrategyDescriptor
> = {
  "cross-encoder": {
    type: "cross-encoder",
    name: "Cross-Encoder Reranker",
    tagline: "Joint query-chunk transformer attention scoring",
    description:
      "Passes (query, chunk) pairs simultaneously through a cross-encoder model (e.g. ms-marco-MiniLM-L-6-v2) to capture deep cross-attention semantics for top-K re-ranking.",
    pipelineRole: "Path A (Advanced RAG)",
    isAvailableInPhase1: false,
  },
  laya: {
    type: "laya",
    name: "Laya Relevance Filter",
    tagline: "Specialized post-retrieval relevance and semantic pruning",
    description:
      "Evaluates retrieved candidate passages via Laya's relevance engine to filter out tangential, noisy, or unhelpful chunks before prompt synthesis.",
    pipelineRole: "Path B (Laya RAG)",
    isAvailableInPhase1: false,
  },
  "similarity-threshold": {
    type: "similarity-threshold",
    name: "Similarity Threshold Filter",
    tagline: "Standard vector distance cut-off baseline",
    description:
      "Filters candidate chunks strictly by initial embedding cosine similarity / bi-encoder score without secondary re-ranking.",
    pipelineRole: "Baseline",
    isAvailableInPhase1: false,
  },
};

/**
 * [STRATEGY IMPLEMENTATION STUB: CrossEncoderEvaluator]
 * Will be populated in Phase 2 with actual cross-encoder re-ranking execution.
 */
export class CrossEncoderEvaluator implements RelevanceEvaluator {
  readonly id = "cross-encoder";
  readonly name = "Cross-Encoder Reranker";
  readonly description =
    "Joint transformer cross-attention reranking for candidate passages.";

  async evaluateRelevance(
    request: RelevanceEvaluationRequest
  ): Promise<RelevanceEvaluationResult> {
    throw new Error(
      `CrossEncoderEvaluator execution is planned for Phase 2. Evaluator strategy interface is active. (Query: "${request.query}")`
    );
  }
}

/**
 * [STRATEGY IMPLEMENTATION STUB: LayaEvaluator]
 * Will be populated in Phase 3 using the LayaAdapter.
 */
export class LayaEvaluator implements RelevanceEvaluator {
  readonly id = "laya";
  readonly name = "Laya Relevance Filter";
  readonly description =
    "Post-retrieval relevance scoring and pruning via Laya engine.";

  async evaluateRelevance(
    request: RelevanceEvaluationRequest
  ): Promise<RelevanceEvaluationResult> {
    throw new Error(
      `LayaEvaluator execution is planned for Phase 3. Evaluator strategy interface is active. (Query: "${request.query}")`
    );
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
      `SimilarityThresholdEvaluator execution is planned for Phase 2. Evaluator strategy interface is active. (Query: "${request.query}")`
    );
  }
}
