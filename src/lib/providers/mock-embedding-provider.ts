import { EmbeddingProvider } from "../interfaces/embedding-provider";

/**
 * [MOCK EMBEDDING PROVIDER]
 * Deterministic pseudo-embedding provider for fast, reproducible unit testing
 * without requiring a running Ollama daemon.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly id = "mock";
  readonly model = "mock-embedding-768d";
  private dimension: number;

  constructor(dimension: number = 768) {
    this.dimension = dimension;
  }

  async embedText(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateDeterministicVector(t));
  }

  async getDimension(): Promise<number> {
    return this.dimension;
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    return { isAvailable: true, message: "MockEmbeddingProvider active" };
  }

  /**
   * Generates a deterministic, normalized vector from text using a seed hash
   */
  private generateDeterministicVector(text: string): number[] {
    const vector = new Array<number>(this.dimension);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    // Populate dimensions with deterministic pseudo-random values
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      // Linear congruential generator step
      hash = (hash * 1664525 + 1013904223) | 0;
      const val = (hash / 2147483648);
      vector[i] = val;
      norm += val * val;
    }

    // Normalize to unit length (L2 norm)
    const magnitude = Math.sqrt(norm) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = vector[i] / magnitude;
    }

    return vector;
  }
}
