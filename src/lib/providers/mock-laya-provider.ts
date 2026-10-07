import {
  LayaProvider,
  LayaCandidatePayload,
  LayaEvaluationResponse,
} from "../interfaces/laya-provider";
import { LayaDecision, LayaDecisionType } from "../types/laya";

/**
 * [MOCK LAYA PROVIDER]
 * Fast, offline, deterministic mock provider for unit tests without PyTorch/Python dependencies.
 * Enables exact testing of KEEP / DROP filtering, lineage preservation, and error handling.
 */
export class MockLayaProvider implements LayaProvider {
  readonly id = "mock";
  readonly model: string;
  private predefinedDecisions?: Map<string, LayaDecisionType>;
  private fixedDecisionSequence?: LayaDecisionType[];
  private shouldFail: boolean = false;
  private failureMessage: string = "Simulated Laya provider error";

  constructor(model: string = "mock-laya-rl-agent") {
    this.model = model;
  }

  /**
   * Configures a map of candidate chunkId -> "keep" | "drop"
   */
  public setPredefinedDecisions(
    decisions: Record<string, LayaDecisionType> | Map<string, LayaDecisionType>
  ): void {
    if (decisions instanceof Map) {
      this.predefinedDecisions = decisions;
    } else {
      this.predefinedDecisions = new Map(Object.entries(decisions));
    }
  }

  /**
   * Configures an ordered sequence of decisions corresponding to candidate indices
   */
  public setFixedDecisions(decisions: LayaDecisionType[]): void {
    this.fixedDecisionSequence = decisions;
  }

  /**
   * Configures the mock to throw an error on next evaluation
   */
  public simulateFailure(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail;
    if (message) this.failureMessage = message;
  }

  async evaluateRelevance(
    query: string,
    candidates: LayaCandidatePayload[]
  ): Promise<LayaEvaluationResponse> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const start = performance.now();
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const decisions: LayaDecision[] = [];

    candidates.forEach((candidate, index) => {
      let decision: LayaDecisionType;
      let keepProb = 0.5;
      let dropProb = 0.5;

      if (this.predefinedDecisions && this.predefinedDecisions.has(candidate.id)) {
        decision = this.predefinedDecisions.get(candidate.id)!;
        keepProb = decision === "keep" ? 0.88 : 0.12;
        dropProb = 1 - keepProb;
      } else if (
        this.fixedDecisionSequence &&
        this.fixedDecisionSequence[index] !== undefined
      ) {
        decision = this.fixedDecisionSequence[index];
        keepProb = decision === "keep" ? 0.85 : 0.15;
        dropProb = 1 - keepProb;
      } else {
        // Deterministic lexical overlap heuristic
        const lowerText = candidate.text.toLowerCase();
        let matchCount = 0;
        for (const term of queryTerms) {
          if (lowerText.includes(term)) matchCount++;
        }

        decision = matchCount > 0 ? "keep" : "drop";
        keepProb = decision === "keep" ? 0.82 : 0.18;
        dropProb = 1 - keepProb;
      }

      decisions.push({
        chunkId: candidate.id,
        decision,
        keepProbability: keepProb,
        dropProbability: dropProb,
        confidence: 0.35,
        answerConfidence: Math.max(keepProb, dropProb),
      });
    });

    const duration = performance.now() - start;

    return {
      decisions,
      evaluationLatencyMs: Number(duration.toFixed(2)),
      modelLoadLatencyMs: 0,
      isColdStart: false,
      model: this.model,
    };
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    return { isAvailable: true, message: "MockLayaProvider is ready" };
  }
}
