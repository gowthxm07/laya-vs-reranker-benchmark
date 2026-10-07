import {
  LLMProvider,
  PromptPayload,
  GenerationOptions,
  GenerationResult,
} from "../interfaces/llm-provider";

export interface OllamaLLMProviderConfig {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * [LLM PROVIDER IMPLEMENTATION: Ollama]
 * Connects to the local Ollama instance running llama3.2:3b.
 * Captures exact token counts (prompt_eval_count, eval_count) and execution latency.
 */
export class OllamaLLMProvider implements LLMProvider {
  readonly id = "ollama";
  readonly name = "Ollama Local Engine";
  readonly model: string;
  readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: OllamaLLMProviderConfig) {
    this.baseUrl =
      config?.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      "http://localhost:11434";
    this.model =
      config?.model ||
      process.env.OLLAMA_LLM_MODEL ||
      process.env.OLLAMA_MODEL ||
      "llama3.2:3b";
    this.timeoutMs = config?.timeoutMs || 120_000; // 2 minutes timeout
  }

  async generateAnswer(
    prompt: PromptPayload,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const startTime = performance.now();

    // Construct the formatted prompt for Ollama
    let fullPrompt = "";
    if (prompt.contextText && prompt.contextText.trim().length > 0) {
      fullPrompt = `CONTEXT:\n${prompt.contextText}\n\nUSER QUESTION:\n${prompt.userQuery}`;
    } else {
      fullPrompt = `CONTEXT:\n[No relevant context passages were retained]\n\nUSER QUESTION:\n${prompt.userQuery}`;
    }

    const payload: Record<string, unknown> = {
      model: this.model,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0,
        seed: options?.seed ?? 42,
        ...(options?.topP !== undefined ? { top_p: options.topP } : {}),
        ...(options?.maxTokens !== undefined ? { num_predict: options.maxTokens } : {}),
        ...(options?.stopSequences ? { stop: options.stopSequences } : {}),
      },
    };

    if (prompt.systemInstruction) {
      payload.system = prompt.systemInstruction;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ollama HTTP error ${response.status} (${response.statusText}): ${errorText}`
        );
      }

      const data = (await response.json()) as {
        response: string;
        done: boolean;
        done_reason?: string;
        prompt_eval_count?: number;
        eval_count?: number;
        total_duration?: number;
        load_duration?: number;
        prompt_eval_duration?: number;
        eval_duration?: number;
      };

      const durationMs = Math.round(performance.now() - startTime);

      const hasExactTokens =
        typeof data.prompt_eval_count === "number" &&
        typeof data.eval_count === "number";

      const promptTokens = hasExactTokens
        ? (data.prompt_eval_count as number)
        : await this.estimateTokenCount(fullPrompt + (prompt.systemInstruction || ""));

      const completionTokens = hasExactTokens
        ? (data.eval_count as number)
        : await this.estimateTokenCount(data.response || "");

      return {
        providerId: this.id,
        model: this.model,
        answerText: data.response || "",
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        latencyMs: durationMs,
        isTokenCountEstimated: !hasExactTokens,
        finishReason: data.done_reason || "stop",
        rawMetadata: {
          totalDurationNs: data.total_duration,
          loadDurationNs: data.load_duration,
          promptEvalDurationNs: data.prompt_eval_duration,
          evalDurationNs: data.eval_duration,
        },
      };
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          throw new Error(
            `Ollama generation timed out after ${this.timeoutMs}ms for model ${this.model}`
          );
        }
        throw new Error(`Ollama generation failed (${durationMs}ms): ${err.message}`);
      }
      throw new Error(`Ollama generation encountered an unknown error (${durationMs}ms)`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async estimateTokenCount(text: string): Promise<number> {
    // Standard heuristic: ~4 characters per token
    return Math.max(1, Math.ceil(text.length / 4));
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return {
          isAvailable: false,
          message: `Ollama service unreachable at ${this.baseUrl} (HTTP ${response.status})`,
        };
      }

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };

      const modelExists = data.models?.some(
        (m) => m.name === this.model || m.name.startsWith(`${this.model}:`)
      );

      if (!modelExists) {
        return {
          isAvailable: false,
          message: `Ollama is running at ${this.baseUrl}, but model '${this.model}' is not installed. Run 'ollama pull ${this.model}'.`,
        };
      }

      return {
        isAvailable: true,
        message: `Ollama service healthy at ${this.baseUrl} with model '${this.model}'.`,
      };
    } catch (err: unknown) {
      return {
        isAvailable: false,
        message: `Failed to connect to Ollama at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
