import { CrossEncoderProvider } from "../interfaces/cross-encoder-provider";
import { PythonCrossEncoderProvider } from "./python-cross-encoder-provider";
import { MockCrossEncoderProvider } from "./mock-cross-encoder-provider";

export type CrossEncoderProviderType = "python" | "mock";

declare global {
  // eslint-disable-next-line no-var
  var __crossEncoderProviderInstanceMap:
    | Map<string, CrossEncoderProvider>
    | undefined;
}

/**
 * [FACTORY PATTERN IMPLEMENTATION]
 * Instantiates and caches the active CrossEncoderProvider.
 * Attached to globalThis to prevent orphan worker processes during Next.js dev reloads.
 */
export class CrossEncoderProviderFactory {
  private static get instanceMap(): Map<string, CrossEncoderProvider> {
    if (!globalThis.__crossEncoderProviderInstanceMap) {
      globalThis.__crossEncoderProviderInstanceMap = new Map();
    }
    return globalThis.__crossEncoderProviderInstanceMap;
  }

  public static getProvider(
    type?: CrossEncoderProviderType,
    customModel?: string
  ): CrossEncoderProvider {
    const providerType: CrossEncoderProviderType =
      type ||
      ((process.env.CROSS_ENCODER_PROVIDER as CrossEncoderProviderType) ||
        "python");

    const cacheKey = `${providerType}:${customModel || "default"}`;
    if (this.instanceMap.has(cacheKey)) {
      return this.instanceMap.get(cacheKey)!;
    }

    let provider: CrossEncoderProvider;
    switch (providerType) {
      case "python":
        provider = new PythonCrossEncoderProvider({ model: customModel });
        break;
      case "mock":
        provider = new MockCrossEncoderProvider(customModel);
        break;
      default:
        throw new Error(
          `Unsupported cross-encoder provider type: ${providerType}`
        );
    }

    this.instanceMap.set(cacheKey, provider);
    return provider;
  }

  public static setMockProvider(mock: CrossEncoderProvider): void {
    this.instanceMap.set("mock:default", mock);
    this.instanceMap.set("python:default", mock);
  }

  public static reset(): void {
    for (const provider of this.instanceMap.values()) {
      if (typeof provider.dispose === "function") {
        provider.dispose();
      }
    }
    this.instanceMap.clear();
  }
}
