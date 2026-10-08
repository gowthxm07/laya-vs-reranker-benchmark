import {
  LLMProvider,
  PromptPayload,
  GenerationOptions,
  GenerationResult,
} from "../interfaces/llm-provider";

export interface MockLLMProviderOptions {
  model?: string;
  customAnswer?: string;
  fixedLatencyMs?: number;
}

/**
 * [MOCK LLM PROVIDER]
 * Deterministic, zero-dependency LLM provider for hermetic automated tests.
 * Captures call history and asserts identical generation parameters.
 */
export class MockLLMProvider implements LLMProvider {
  readonly id = "mock-llm";
  readonly name = "Mock Deterministic LLM";
  readonly model: string;
  private customAnswer?: string;
  private fixedLatencyMs: number;
  private simulateError: boolean = false;
  private errorMessage: string = "Simulated LLM generation failure";

  // Call inspection history
  public callHistory: Array<{
    prompt: PromptPayload;
    options?: GenerationOptions;
    timestamp: number;
  }> = [];

  constructor(options?: MockLLMProviderOptions) {
    this.model = options?.model || "mock-llama3.2:3b";
    this.customAnswer = options?.customAnswer;
    this.fixedLatencyMs = options?.fixedLatencyMs ?? 45;
  }

  public setSimulateError(simulate: boolean, message?: string): void {
    this.simulateError = simulate;
    if (message) this.errorMessage = message;
  }

  public setCustomAnswer(answer: string): void {
    this.customAnswer = answer;
  }

  public resetHistory(): void {
    this.callHistory = [];
  }

  async generateAnswer(
    prompt: PromptPayload,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    this.callHistory.push({
      prompt: { ...prompt },
      options: options ? { ...options } : undefined,
      timestamp: Date.now(),
    });

    if (this.simulateError) {
      throw new Error(this.errorMessage);
    }

    let answerText = "";
    if (this.customAnswer) {
      answerText = this.customAnswer;
    } else if (!prompt.contextText || prompt.contextText.trim() === "" || prompt.contextText.includes("[No relevant context passages were retained]")) {
      answerText =
        "The provided context does not contain sufficient information to answer this question.";
    } else {
      // Deterministic, grounded mock answer synthesizing content directly from the provided passages.
      // Extracts substantive content lines so that retained factual keywords are reflected in the response.
      const rawPassages = prompt.contextText
        .split(/(?:\[Passage\s+\d+\]|---)/i)
        .map((s) => s.trim())
        .filter(Boolean);

      const contentSentences: string[] = [];
      for (const p of rawPassages) {
        const lines = p
          .split("\n")
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 0 &&
              !l.toLowerCase().startsWith("document:") &&
              !l.toLowerCase().startsWith("source:") &&
              !l.toLowerCase().startsWith("page:") &&
              !l.toLowerCase().startsWith("section:")
          );

        for (const line of lines) {
          const sents = line
            .split(/(?<=[.?!])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 10);
          if (sents.length > 0) {
            contentSentences.push(sents[0]);
          } else if (line.length > 10) {
            contentSentences.push(line);
          }
          if (contentSentences.length >= 3) break;
        }
        if (contentSentences.length >= 3) break;
      }

      if (contentSentences.length > 0) {
        answerText = `Based strictly on the provided context passages: ${contentSentences.join(" ")}`;
      } else {
        answerText = `Based strictly on the provided context passages, regarding "${prompt.userQuery}": The facts state that relevant information is verified in the retrieved evidence.`;
      }
    }

    const promptTokens = Math.ceil((prompt.contextText.length + prompt.userQuery.length + (prompt.systemInstruction?.length || 0)) / 4);
    const completionTokens = Math.ceil(answerText.length / 4);

    return {
      providerId: this.id,
      model: this.model,
      answerText,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      latencyMs: this.fixedLatencyMs,
      isTokenCountEstimated: false,
      finishReason: "stop",
      rawMetadata: {
        mocked: true,
        callCount: this.callHistory.length,
      },
    };
  }

  async estimateTokenCount(text: string): Promise<number> {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    return {
      isAvailable: !this.simulateError,
      message: this.simulateError ? this.errorMessage : "Mock LLM provider is active.",
    };
  }
}
