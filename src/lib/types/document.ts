/**
 * Core Ingested Document Entity
 */
export interface Document {
  /** Unique document identifier */
  id: string;

  /** File name (e.g. 'company-policy.pdf') */
  filename: string;

  /** MIME type (e.g. 'application/pdf', 'text/plain', 'text/markdown') */
  mimeType: string;

  /** File size in bytes */
  size: number;

  /** Ingestion timestamp in epoch ms */
  createdAt: number;

  /** Total pages extracted (for paginated documents like PDF) */
  pageCount?: number;

  /** Total chunks generated from this document */
  chunkCount?: number;

  /** Arbitrary document metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Discrete page extracted from a document
 */
export interface ParsedDocumentPage {
  pageNumber: number;
  text: string;
}

/**
 * Result of parsing raw file contents
 */
export interface ParsedDocument {
  documentId: string;
  filename: string;
  mimeType: string;
  text: string;
  pages: ParsedDocumentPage[];
  pageCount: number;
  metadata?: Record<string, unknown>;
}
