import { ParsedDocument } from "../types/document";

export interface ParseOptions {
  documentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * [STRATEGY / FACTORY CONTRACT]
 * Pluggable document parser interface for extracting clean, page-attributed
 * text from heterogeneous file formats.
 */
export interface DocumentParser {
  /** Supported MIME types */
  readonly supportedMimeTypes: string[];

  /** Supported file extensions (including leading dot, e.g. '.pdf') */
  readonly supportedExtensions: string[];

  /** Checks if this parser can handle the provided MIME type or filename */
  canParse(mimeType: string, filename: string): boolean;

  /**
   * Parses binary or text file buffer into a structured ParsedDocument.
   * Throws an error if extraction yields empty text or format is invalid.
   */
  parse(
    buffer: Buffer,
    filename: string,
    options?: ParseOptions
  ): Promise<ParsedDocument>;
}
