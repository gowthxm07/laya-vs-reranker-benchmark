import { EmbeddingProvider } from "../interfaces/embedding-provider";

export interface OllamaEmbeddingConfig {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * [OLLAMA LOCAL EMBEDDING PROVIDER]
 * Generates local dense embeddings using Ollama's native embeddings endpoint.
 * Default model: nomic-embed-text (768 dimensions).
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = "ollama";
  readonly model: string;
  readonly baseUrl: string;
  private timeoutMs: number;
  private cachedDimension?: number;

  constructor(config?: OllamaEmbeddingConfig) {
    this.model =
      config?.model || process.env.EMBEDDING_MODEL || "nomic-embed-text";
    this.baseUrl =
      config?.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.timeoutMs = config?.timeoutMs || 25000;
  }

  async embedText(text: string): Promise<number[]> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Cannot generate embedding for empty text.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: trimmed,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Ollama embedding request failed (${response.status} ${response.statusText}): ${errorText}`
        );
      }

      const data = (await response.json()) as { embedding: number[] };
      if (!data || !Array.isArray(data.embedding)) {
        throw new Error(
          `Invalid response format from Ollama embeddings endpoint for model "${this.model}".`
        );
      }

      if (!this.cachedDimension) {
        this.cachedDimension = data.embedding.length;
      }

      return data.embedding;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `Ollama embedding request timed out after ${this.timeoutMs}ms for model "${this.model}".`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    // Process with controlled concurrency to avoid overloading local inference thread
    for (const text of texts) {
      const vector = await this.embedText(text);
      results.push(vector);
    }
    return results;
  }

  async getDimension(): Promise<number> {
    if (this.cachedDimension) return this.cachedDimension;
    // Probe dimension with a tiny token
    const sample = await this.embedText("probe");
    this.cachedDimension = sample.length;
    return this.cachedDimension;
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
      });
      if (!response.ok) {
        return {
          isAvailable: false,
          message: `Ollama responded with HTTP ${response.status}`,
        };
      }
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const hasModel = Boolean(
        data.models?.some((m) => m.name.includes(this.model.split(":")[0]))
      );
      if (!hasModel) {
        return {
          isAvailable: false,
          message: `Ollama is running, but model "${this.model}" is not installed. Run: ollama pull ${this.model}`,
        };
      }
      return { isAvailable: true, message: `Ollama ready with model "${this.model}"` };
    } catch (err) {
      return {
        isAvailable: false,
        message: `Could not connect to Ollama at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
