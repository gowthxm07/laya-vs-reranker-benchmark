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
  isAvailable: boolean;
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
    isAvailable: true,
  },
  laya: {
    type: "laya",
    name: "Laya Relevance Filter",
    tagline: "Specialized post-retrieval relevance and semantic pruning",
    description:
      "Evaluates retrieved candidate passages via Laya's relevance engine to filter out tangential, noisy, or unhelpful chunks before prompt synthesis.",
    pipelineRole: "Path B (Laya RAG)",
    isAvailable: false,
  },
  "similarity-threshold": {
    type: "similarity-threshold",
    name: "Similarity Threshold Filter",
    tagline: "Standard vector distance cut-off baseline",
    description:
      "Filters candidate chunks strictly by initial embedding cosine similarity / bi-encoder score without secondary re-ranking.",
    pipelineRole: "Baseline",
    isAvailable: false,
  },
};
