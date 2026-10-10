import { UserRole } from "./security-experiment";

/**
 * 10 Test Categories for the Security Benchmark Suite
 */
export type SecurityBenchmarkCategory =
  | "BENIGN_PUBLIC"
  | "UNAUTHORIZED_CONFIDENTIAL"
  | "UNAUTHORIZED_RESTRICTED"
  | "CANARY_EXTRACTION"
  | "PROMPT_INJECTION"
  | "MIXED_CONTEXT"
  | "RELEVANT_SENSITIVE"
  | "AUTHORIZED_ACCESS"
  | "AMBIGUOUS_METADATA"
  | "INDIRECT_PARAPHRASING";

/**
 * Schema for an individual security benchmark test case
 */
export interface SecurityBenchmarkCase {
  /** Stable unique identifier (e.g., SEC-BENCH-01) */
  id: string;
  /** Test Category */
  category: SecurityBenchmarkCategory;
  /** Natural language query sent to the RAG system */
  query: string;
  /** Simulated user role under test */
  simulatedRole: UserRole;
  /** Target document filename required in vector index */
  documentFilename: string;
  /** Whether the request is permitted or prohibited under policy */
  isPermitted: boolean;
  /** Ground-truth behavioral expectation */
  expectedBehavior: "DISCLOSE" | "REFUSE";
  /** Relevant synthetic record IDs from the test document */
  targetRecordIds: string[];
  /** Substrings or patterns that must NOT appear in the answer */
  prohibitedTerms: string[];
  /** Substrings or facts that should appear in a correct permitted answer */
  requiredFacts: string[];
  /** Short rationale of the expected outcome */
  explanation: string;
}

/**
 * Outcome evaluation result for a single pipeline answer
 */
export interface CaseEvaluationResult {
  /** Did the answer disclose the synthetic canary marker? */
  isCanaryDisclosed: boolean;
  /** Did the answer disclose unauthorized sensitive facts (exact or semantic)? */
  isSensitiveDisclosed: boolean;
  /** Were unauthorized sensitive chunks included in the LLM prompt context? */
  isContextExposed: boolean;
  /** Did the system appropriately refuse the prohibited request? */
  isAppropriateRefusal: boolean;
  /** Did the system correctly and usefully answer a benign permitted query? */
  isBenignSuccess: boolean;
  /** Did the system correctly answer an authorized sensitive query? */
  isAuthorizedSuccess: boolean;
  /** Did an adversarial prompt injection succeed in forcing a violation? */
  isInjectionSucceeded: boolean;
  /** Was relevant public information unnecessarily lost or unavailable? */
  isPublicInfoLost: boolean;
  /** Specific findings or matched sensitive patterns */
  findings: string[];
  /** Detailed human-readable rationale of the evaluator decision */
  evaluationRationale: string;
}

/**
 * Per-case execution and evaluation record for one path (Path A or Path B)
 */
export interface PathBenchmarkCaseResult {
  engine: "cross-encoder" | "laya";
  guardrailType: "conventional" | "instructions-only";
  caseId: string;
  query: string;
  simulatedRole: UserRole;
  isPermitted: boolean;
  generatedAnswer: string;
  rawContextText: string;
  retrievedChunkIds: string[];
  retainedChunkIds: string[];
  discardedChunkIds: string[];
  blockedChunkIds: string[];
  includedChunkIds: string[];
  evaluation: CaseEvaluationResult;
  promptTokens: number;
  completionTokens: number;
  relevanceLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
  status: "completed" | "error";
  errorMessage?: string;
}

/**
 * Formatted metric fraction with raw count and percentage
 */
export interface MetricFraction {
  numerator: number;
  denominator: number;
  percentage: number | null;
  /** Formatted string, e.g. "2 / 10 (20.0%)" or "N/A" */
  formatted: string;
}

/**
 * Aggregate security and utility metrics for a pipeline path
 */
export interface SecurityBenchmarkMetrics {
  // Security Metrics
  canaryDisclosureRate: MetricFraction;
  unauthorizedSensitiveDisclosureRate: MetricFraction;
  unauthorizedContextExposureRate: MetricFraction;
  promptInjectionSuccessRate: MetricFraction;

  // Utility Metrics
  benignAnswerSuccessRate: MetricFraction;
  appropriateRefusalRate: MetricFraction;
  authorizedAnswerSuccessRate: MetricFraction;
  relevantPublicInformationLossRate: MetricFraction;
}

/**
 * Complete machine-readable record of a security benchmark run
 */
export interface SecurityBenchmarkRunResult {
  runId: string;
  timestamp: number;
  datasetVersion: string;
  documentId: string;
  documentFilename: string;
  isSmokeTest: boolean;
  caseCount: number;
  completedCount: number;
  errorCount: number;
  durationMs: number;
  pathAMetrics: SecurityBenchmarkMetrics;
  pathBMetrics: SecurityBenchmarkMetrics;
  caseResults: Array<{
    caseItem: SecurityBenchmarkCase;
    pathA: PathBenchmarkCaseResult;
    pathB: PathBenchmarkCaseResult;
  }>;
}

/**
 * Summary descriptor of a saved security benchmark run for history listing
 */
export interface SecurityRunSummaryItem {
  filename: string;
  runId: string;
  timestamp: number;
  documentFilename: string;
  isSmokeTest: boolean;
  caseCount: number;
  completedCount: number;
  errorCount: number;
  durationMs: number;
  pathACanaryDisclosure: string;
  pathBCanaryDisclosure: string;
  pathASensitiveDisclosure: string;
  pathBSensitiveDisclosure: string;
  pathABenignSuccess: string;
  pathBBenignSuccess: string;
}
