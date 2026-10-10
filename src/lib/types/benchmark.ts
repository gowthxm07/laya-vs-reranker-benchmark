import { Chunk } from "./chunk";
import { ComparisonMode } from "./comparison";

export type BenchmarkCategory =
  | "NORMAL"
  | "DISTRACTOR_HEAVY"
  | "MULTI_CHUNK"
  | "AMBIGUOUS"
  | "PARTIAL_CONTEXT"
  | "NO_ANSWER"
  | "SINGLE_RELEVANT"
  | "CONFLICTING_CONTEXT"
  | "LONG_CONTEXT";

export interface BenchmarkCase {
  id: string;
  category: BenchmarkCategory;
  query: string;
  description: string;
  candidateChunks: Chunk[];
  relevantChunkIds: string[];
  referenceAnswer: string;
  answerable: boolean;
  requiredFacts?: string[];
}

export interface RelevanceMetrics {
  precision: number;
  recall: number;
  f1: number;
  hitRate: number;
  mrr?: number | null;
  ndcg?: number | null;
  isRankingMetricApplicable: boolean;
}

export interface ContextEfficiencyMetrics {
  initialCandidateCount: number;
  retainedCount: number;
  retentionRate: number;
  contextReductionPercent: number;
  initialContextCharacters: number;
  retainedContextCharacters: number;
  characterReductionPercent: number;
  initialContextTokens: number;
  retainedContextTokens: number;
  tokenReductionPercent: number;
}

export interface AnswerQualityMetrics {
  exactMatch?: boolean;
  referenceAnswerSimilarity: number;
  factCoverage: number;
  noAnswerCompliance?: boolean;
  faithfulnessScore: number;
  lexicalGroundednessScore?: number;
}

export interface CandidateChunkDecision {
  id: string;
  source?: string;
  pageNumber?: number;
  textSnippet: string;
  fullText?: string;
  isGroundTruthRelevant: boolean;
  crossEncoder: {
    selected: boolean;
    score?: number;
    rank?: number;
  };
  laya: {
    selected: boolean;
    decision: "keep" | "drop";
    keepProbability?: number;
    threshold?: number;
  };
}

export type FailureClassification =
  | "BOTH_CORRECT"
  | "BOTH_INCORRECT"
  | "CROSS_ENCODER_FALSE_NEGATIVE"
  | "CROSS_ENCODER_FALSE_POSITIVE"
  | "LAYA_FALSE_NEGATIVE"
  | "LAYA_FALSE_POSITIVE"
  | "PARTIAL_AGREEMENT";

export interface StrategyCaseEvaluation {
  strategyId: "cross-encoder" | "laya";
  strategyName: string;
  selectedChunkIds: string[];
  relevanceMetrics: RelevanceMetrics;
  contextMetrics: ContextEfficiencyMetrics;
  answer: string;
  answerMetrics: AnswerQualityMetrics;
  latencies: {
    relevanceMs: number;
    contextBuildMs: number;
    generationMs: number;
    totalMs: number;
  };
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    tokensSaved: number;
    tokenReductionPercent: number;
  };
  error?: string;
}

export interface QueryBenchmarkResult {
  queryId: string;
  category: BenchmarkCategory;
  query: string;
  description: string;
  answerable: boolean;
  groundTruth: {
    relevantChunkIds: string[];
    referenceAnswer: string;
    requiredFacts: string[];
  };
  initialCandidateCount: number;
  crossEncoder: StrategyCaseEvaluation;
  laya: StrategyCaseEvaluation;
  failureAnalysis: {
    crossEncoderFailures: string[];
    layaFailures: string[];
    classification: FailureClassification;
    notes: string;
  };
  pairedDifferences: {
    f1Diff: number;
    precisionDiff: number;
    recallDiff: number;
    contextReductionDiff: number;
    tokenDiff: number;
    relevanceLatencyDiffMs: number;
    totalLatencyDiffMs: number;
  };
  candidateDecisions?: CandidateChunkDecision[];
}

export interface MetricAggregate {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface CategoryAggregate {
  category: BenchmarkCategory;
  caseCount: number;
  crossEncoder: {
    meanPrecision: number;
    meanRecall: number;
    meanF1: number;
    meanHitRate: number;
    meanContextReduction: number;
    meanTotalTokens: number;
    meanRelevanceLatencyMs: number;
    meanTotalLatencyMs: number;
    meanFactCoverage: number;
  };
  laya: {
    meanPrecision: number;
    meanRecall: number;
    meanF1: number;
    meanHitRate: number;
    meanContextReduction: number;
    meanTotalTokens: number;
    meanRelevanceLatencyMs: number;
    meanTotalLatencyMs: number;
    meanFactCoverage: number;
  };
}

export interface PairedComparisonSummary {
  metricName: string;
  meanDifference: number;
  medianDifference: number;
  ceBetterCount: number;
  layaBetterCount: number;
  tieCount: number;
  totalComparisons: number;
}

export interface ParetoAnalysisSummary {
  dimensions: string[];
  ceDominatesLayaCount: number;
  layaDominatesCeCount: number;
  tradeoffCount: number;
  summary: string;
}

export interface BenchmarkRunMetadata {
  timestamp: number;
  gitCommit: string;
  datasetVersion: string;
  mode: ComparisonMode;
  contextBudget?: number;
  layaThreshold?: number;
  runsPerQuery: number;
  llmModel: string;
  crossEncoderModel: string;
  layaModel: string;
  embeddingModel: string;
  deviceInfo: string;
}

export interface BenchmarkSuiteResult {
  runId: string;
  metadata: BenchmarkRunMetadata;
  caseCount: number;
  completedCount: number;
  failureCount: number;
  durationMs: number;
  queryResults: QueryBenchmarkResult[];
  crossEncoderAggregates: Record<string, MetricAggregate>;
  layaAggregates: Record<string, MetricAggregate>;
  categoryAggregates: Record<BenchmarkCategory, CategoryAggregate>;
  pairedComparisons: Record<string, PairedComparisonSummary>;
  paretoAnalysis: ParetoAnalysisSummary;
}
