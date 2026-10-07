import {
  CrossEncoderProvider,
  CrossEncoderPredictionResult,
} from "../interfaces/cross-encoder-provider";

/**
 * [MOCK CROSS-ENCODER PROVIDER]
 * Deterministic, offline mock provider for fast unit tests without Python/PyTorch dependencies.
 * Allows tests to supply predefined score maps or uses deterministic lexical scoring.
 */
export class MockCrossEncoderProvider implements CrossEncoderProvider {
  readonly id = "mock";
  readonly model: string;
  private predefinedScores?: Map<string, number>;
  private fixedScores?: number[];
  private shouldFail: boolean = false;
  private failureMessage: string = "Simulated cross-encoder provider error";

  constructor(model: string = "cross-encoder/ms-marco-MiniLM-L-6-v2") {
    this.model = model;
  }

  /**
   * Configures an array of fixed scores aligned to the order of candidates evaluated
   */
  public setFixedScores(scores: number[]): void {
    this.fixedScores = scores;
  }

  /**
   * Configures a map of chunk text -> score for precise assertion in unit tests
   */
  public setPredefinedScores(scoreMap: Map<string, number>): void {
    this.predefinedScores = scoreMap;
  }

  /**
   * Configures provider to simulate a failure
   */
  public simulateFailure(shouldFail: boolean, message?: string): void {
    this.shouldFail = shouldFail;
    if (message) this.failureMessage = message;
  }

  async predictScores(
    query: string,
    candidateTexts: string[]
  ): Promise<CrossEncoderPredictionResult> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    const start = performance.now();
    let scores: number[] = [];

    if (this.fixedScores && this.fixedScores.length > 0) {
      scores = candidateTexts.map((_, i) => this.fixedScores![i] ?? 0);
    } else {
      for (const text of candidateTexts) {
        if (this.predefinedScores && this.predefinedScores.has(text)) {
          scores.push(this.predefinedScores.get(text)!);
        } else {
          // Deterministic pseudo-logit based on query overlap + character hash
          const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
          let matchCount = 0;
          const lowerText = text.toLowerCase();
          for (const term of queryTerms) {
            if (lowerText.includes(term)) matchCount++;
          }

          // Base logit centered around 0.0 with positive boost for matches
          let hash = 0;
          for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash |= 0;
          }
          const jitter = (Math.abs(hash) % 100) / 100;
          const score = Number(((matchCount * 2.5) - 2.0 + jitter).toFixed(4));
          scores.push(score);
        }
      }
    }

    const duration = performance.now() - start;

    return {
      scores,
      evaluationLatencyMs: Number(duration.toFixed(2)),
      modelLoadLatencyMs: 0,
      isColdStart: false,
    };
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    return { isAvailable: true, message: "MockCrossEncoderProvider ready" };
  }
}
