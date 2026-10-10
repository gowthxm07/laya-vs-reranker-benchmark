import { LayaProvider } from "../interfaces/laya-provider";
import { PythonLayaProvider } from "./python-laya-provider";
import { MockLayaProvider } from "./mock-laya-provider";

export type LayaProviderType = "python" | "mock";

declare global {
  // eslint-disable-next-line no-var
  var __layaProviderInstanceMap: Map<string, LayaProvider> | undefined;
}

/**
 * [FACTORY PATTERN IMPLEMENTATION]
 * Instantiates and caches the active LayaProvider.
 * Enables switching between live Python runtime and offline deterministic mocks.
 * Attached to globalThis to prevent orphan worker processes during Next.js dev reloads.
 */
export class LayaProviderFactory {
  private static get instanceMap(): Map<string, LayaProvider> {
    if (!globalThis.__layaProviderInstanceMap) {
      globalThis.__layaProviderInstanceMap = new Map();
    }
    return globalThis.__layaProviderInstanceMap;
  }

  public static getProvider(
    type?: LayaProviderType,
    customModel?: string
  ): LayaProvider {
    const providerType: LayaProviderType =
      type ||
      ((process.env.LAYA_PROVIDER as LayaProviderType) || "python");

    const cacheKey = `${providerType}:${customModel || "default"}`;
    if (this.instanceMap.has(cacheKey)) {
      return this.instanceMap.get(cacheKey)!;
    }

    let provider: LayaProvider;
    switch (providerType) {
      case "python":
        provider = new PythonLayaProvider({ modelPath: customModel });
        break;
      case "mock":
        provider = new MockLayaProvider(customModel);
        break;
      default:
        throw new Error(`Unsupported Laya provider type: ${providerType}`);
    }

    this.instanceMap.set(cacheKey, provider);
    return provider;
  }

  public static setMockProvider(mock: LayaProvider): void {
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
