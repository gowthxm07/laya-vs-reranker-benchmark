import {
  LLMProvider,
  PromptPayload,
  GenerationOptions,
  GenerationResult,
} from "../../interfaces/llm-provider";

export type LLMProviderType = "ollama" | "openrouter";

/**
 * Concrete provider configuration for Ollama (Primary local target: llama3.2:3b)
 */
export class OllamaProvider implements LLMProvider {
  readonly id = "ollama";
  readonly name = "Ollama Local Engine";
  readonly model: string;
  readonly baseUrl: string;

  constructor(model?: string, baseUrl?: string) {
    this.model =
      model || process.env.OLLAMA_MODEL || "llama3.2:3b";
    this.baseUrl =
      baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  }

  async generateAnswer(
    _prompt: PromptPayload,
    _options?: GenerationOptions
  ): Promise<GenerationResult> {
    throw new Error(
      `OllamaProvider (model: ${this.model}) execution is planned for Phase 4. LLM provider contract is active.`
    );
  }

  async estimateTokenCount(text: string): Promise<number> {
    // Rough heuristic: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    return {
      isAvailable: false,
      message: `Local Ollama instance check configured for ${this.baseUrl} with model ${this.model} (Phase 1 inactive)`,
    };
  }
}

/**
 * Concrete provider configuration for OpenRouter (Secondary remote fallback)
 */
export class OpenRouterProvider implements LLMProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter Remote Engine";
  readonly model: string;
  readonly apiKey?: string;

  constructor(model?: string, apiKey?: string) {
    this.model =
      model ||
      process.env.OPENROUTER_MODEL ||
      "meta-llama/llama-3.2-3b-instruct";
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY;
  }

  async generateAnswer(
    _prompt: PromptPayload,
    _options?: GenerationOptions
  ): Promise<GenerationResult> {
    throw new Error(
      `OpenRouterProvider (model: ${this.model}) execution is reserved for Phase 4. Provider contract is active.`
    );
  }

  async estimateTokenCount(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    return {
      isAvailable: false,
      message: "OpenRouter remote check (Phase 1 inactive, no keys required)",
    };
  }
}

/**
 * [FACTORY PATTERN IMPLEMENTATION: LLMProviderFactory]
 * Constructs interchangeable LLM providers without hardcoding provider classes.
 */
export class LLMProviderFactory {
  public static createProvider(type: LLMProviderType = "ollama"): LLMProvider {
    switch (type) {
      case "ollama":
        return new OllamaProvider();
      case "openrouter":
        return new OpenRouterProvider();
      default:
        throw new Error(`Unsupported LLM provider type: ${type}`);
    }
  }

  public static getDefaultProvider(): LLMProvider {
    return this.createProvider("ollama");
  }
}
