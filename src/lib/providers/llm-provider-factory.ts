import { LLMProvider } from "../interfaces/llm-provider";
import { OllamaLLMProvider } from "./ollama-llm-provider";
import { MockLLMProvider } from "./mock-llm-provider";

export type LLMProviderType = "ollama" | "mock" | "openrouter";

/**
 * [FACTORY PATTERN IMPLEMENTATION: LLMProviderFactory]
 * Creates and caches interchangeable LLM provider instances.
 * Default provider is Ollama (llama3.2:3b), configurable via LLM_PROVIDER.
 */
export class LLMProviderFactory {
  private static cachedProvider: LLMProvider | null = null;

  public static getProvider(
    type?: LLMProviderType,
    customModel?: string
  ): LLMProvider {
    const selectedType =
      type ||
      (process.env.LLM_PROVIDER as LLMProviderType) ||
      "ollama";

    if (this.cachedProvider && !type && !customModel) {
      return this.cachedProvider;
    }

    let provider: LLMProvider;

    switch (selectedType) {
      case "ollama":
        provider = new OllamaLLMProvider({
          model: customModel,
        });
        break;
      case "mock":
        provider = new MockLLMProvider({
          model: customModel,
        });
        break;
      default:
        provider = new OllamaLLMProvider({
          model: customModel,
        });
        break;
    }

    if (!type && !customModel) {
      this.cachedProvider = provider;
    }

    return provider;
  }

  public static setProvider(provider: LLMProvider | null): void {
    this.cachedProvider = provider;
  }
}
