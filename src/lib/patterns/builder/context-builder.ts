import { Chunk } from "../../types/chunk";
import {
  IContextBuilder,
  ContextFormatOptions,
} from "../../interfaces/context-builder";

/**
 * [BUILDER PATTERN IMPLEMENTATION]
 * Assembles and formats retained candidate passages into a structured prompt context.
 */
export class ContextBuilder implements IContextBuilder {
  private chunks: Chunk[] = [];
  private maxTokenBudget: number = 2048;
  private formatOptions: ContextFormatOptions = {
    includeDocumentId: true,
    includeScores: true,
    includeSourceMetadata: true,
    chunkDelimiter: "\n---\n",
  };

  public addChunk(chunk: Chunk): this {
    this.chunks.push(chunk);
    return this;
  }

  public addChunks(chunks: Chunk[]): this {
    this.chunks.push(...chunks);
    return this;
  }

  public setMaxTokenBudget(tokens: number): this {
    this.maxTokenBudget = tokens;
    return this;
  }

  public sortByRelevance(): this {
    this.chunks.sort((a, b) => {
      const scoreA = a.relevanceScore ?? a.retrievalScore ?? 0;
      const scoreB = b.relevanceScore ?? b.retrievalScore ?? 0;
      return scoreB - scoreA;
    });
    return this;
  }

  public setFormatOptions(options: ContextFormatOptions): this {
    this.formatOptions = { ...this.formatOptions, ...options };
    return this;
  }

  public reset(): this {
    this.chunks = [];
    return this;
  }

  public build(): string {
    if (this.chunks.length === 0) {
      return "";
    }

    const formattedPassages: string[] = [];
    let estimatedTokensUsed = 0;

    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const headerParts: string[] = [`[Passage ${i + 1}]`];

      if (this.formatOptions.includeDocumentId && chunk.source) {
        headerParts.push(`Source: ${chunk.source}`);
      }
      if (this.formatOptions.includeScores && chunk.relevanceScore !== undefined) {
        headerParts.push(`Score: ${chunk.relevanceScore.toFixed(3)}`);
      }

      const passageBlock = `${headerParts.join(" | ")}\n${chunk.text.trim()}`;
      const approxTokens = Math.ceil(passageBlock.length / 4);

      if (estimatedTokensUsed + approxTokens > this.maxTokenBudget) {
        // Enforce token budget limit
        break;
      }

      formattedPassages.push(passageBlock);
      estimatedTokensUsed += approxTokens;
    }

    return formattedPassages.join(this.formatOptions.chunkDelimiter || "\n---\n");
  }
}
