import { Chunk } from "../types/chunk";
import { ParsedDocument, ParsedDocumentPage } from "../types/document";

export interface ChunkerOptions {
  /** Target chunk size in characters (default: 500 characters, ~125 tokens) */
  chunkSize?: number;

  /** Target chunk overlap in characters (default: 100 characters, ~25 tokens) */
  chunkOverlap?: number;

  /** Minimum chunk size to retain (avoids single-character orphan chunks, default: 40) */
  minChunkSize?: number;
}

/**
 * [CHUNKER CONTRACT]
 * Deterministically segments parsed document text into chunks
 * while preserving page provenance, source attribution, and document ID.
 */
export class DeterministicChunker {
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly minChunkSize: number;

  constructor(options?: ChunkerOptions) {
    this.chunkSize = options?.chunkSize ?? 500;
    this.chunkOverlap = options?.chunkOverlap ?? 100;
    this.minChunkSize = options?.minChunkSize ?? 40;

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error(
        `chunkOverlap (${this.chunkOverlap}) must be smaller than chunkSize (${this.chunkSize}).`
      );
    }
  }

  /**
   * Deterministically splits a ParsedDocument into an array of Chunks.
   * Processes each page independently to guarantee that chunks NEVER cross
   * page boundaries without accurate page attribution.
   */
  public chunkDocument(document: ParsedDocument): Chunk[] {
    const allChunks: Chunk[] = [];
    let globalChunkIndex = 0;

    // If document has discrete pages, chunk per page
    if (document.pages && document.pages.length > 0) {
      for (const page of document.pages) {
        const pageChunks = this.chunkPage(document, page, globalChunkIndex);
        allChunks.push(...pageChunks);
        globalChunkIndex += pageChunks.length;
      }
    } else {
      // Fallback for single unpaginated text block
      const singlePage: ParsedDocumentPage = {
        pageNumber: 1,
        text: document.text,
      };
      allChunks.push(...this.chunkPage(document, singlePage, 0));
    }

    return allChunks;
  }

  /**
   * Deterministically chunks a single page's text using word-boundary-aware sliding windows.
   */
  private chunkPage(
    document: ParsedDocument,
    page: ParsedDocumentPage,
    startIndex: number
  ): Chunk[] {
    const pageText = page.text.trim();
    if (!pageText) return [];

    const chunks: Chunk[] = [];
    let startChar = 0;
    let localIndex = 0;

    while (startChar < pageText.length) {
      let endChar = startChar + this.chunkSize;

      // If not at the end of the page text, search for a natural word/sentence break
      if (endChar < pageText.length) {
        // Look backwards up to 60 characters for paragraph break, period, newline, or space
        const breakOffsets = ["\n\n", ". ", "\n", "; ", " "];

        let foundBoundary = -1;
        for (const delimiter of breakOffsets) {
          const idx = pageText.lastIndexOf(delimiter, endChar);
          if (idx > startChar + (this.chunkSize * 0.6)) {
            foundBoundary = idx + delimiter.length;
            break;
          }
        }

        if (foundBoundary > startChar) {
          endChar = foundBoundary;
        }
      } else {
        endChar = pageText.length;
      }

      const chunkText = pageText.substring(startChar, endChar).trim();

      if (chunkText.length >= this.minChunkSize || (chunks.length === 0 && chunkText.length > 0)) {
        const chunkIndex = startIndex + localIndex;
        // Deterministic stable chunk ID
        const chunkId = `${document.documentId}_p${page.pageNumber}_c${chunkIndex}`;

        chunks.push({
          id: chunkId,
          documentId: document.documentId,
          text: chunkText,
          source: document.filename,
          pageNumber: page.pageNumber,
          decision: "pending",
          metadata: {
            ...document.metadata,
            charStart: startChar,
            charEnd: endChar,
            chunkLength: chunkText.length,
          },
        });
        localIndex++;
      }

      // Advance sliding window with overlap
      const step = Math.max(1, (endChar - startChar) - this.chunkOverlap);
      startChar += step;

      // Guard against potential infinite loop if endChar didn't advance
      if (endChar >= pageText.length) {
        break;
      }
    }

    return chunks;
  }
}
