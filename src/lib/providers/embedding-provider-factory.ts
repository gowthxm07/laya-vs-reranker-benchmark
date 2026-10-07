import { EmbeddingProvider } from "../interfaces/embedding-provider";
import { OllamaEmbeddingProvider } from "./ollama-embedding-provider";
import { MockEmbeddingProvider } from "./mock-embedding-provider";

export type EmbeddingProviderType = "ollama" | "mock";

/**
 * [FACTORY PATTERN IMPLEMENTATION]
 * Instantiates the configured EmbeddingProvider based on runtime environment.
 */
export class EmbeddingProviderFactory {
  private static instanceMap: Map<string, EmbeddingProvider> = new Map();

  public static getProvider(
    type?: EmbeddingProviderType,
    customModel?: string
  ): EmbeddingProvider {
    const providerType: EmbeddingProviderType =
      type ||
      ((process.env.EMBEDDING_PROVIDER as EmbeddingProviderType) || "ollama");

    const cacheKey = `${providerType}:${customModel || "default"}`;
    if (this.instanceMap.has(cacheKey)) {
      return this.instanceMap.get(cacheKey)!;
    }

    let provider: EmbeddingProvider;
    switch (providerType) {
      case "ollama":
        provider = new OllamaEmbeddingProvider({ model: customModel });
        break;
      case "mock":
        provider = new MockEmbeddingProvider();
        break;
      default:
        throw new Error(`Unsupported embedding provider type: ${providerType}`);
    }

    this.instanceMap.set(cacheKey, provider);
    return provider;
  }

  public static setMockProvider(mock: EmbeddingProvider): void {
    this.instanceMap.set("mock:default", mock);
  }
}
