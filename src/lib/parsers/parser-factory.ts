import { DocumentParser } from "../interfaces/document-parser";
import { TextDocumentParser } from "./text-parser";
import { MarkdownDocumentParser } from "./markdown-parser";
import { PdfDocumentParser } from "./pdf-parser";

/**
 * [FACTORY PATTERN IMPLEMENTATION]
 * Instantiates and resolves appropriate DocumentParser instances based on file extension and MIME type.
 */
export class DocumentParserFactory {
  private static parsers: DocumentParser[] = [
    new PdfDocumentParser(),
    new MarkdownDocumentParser(),
    new TextDocumentParser(),
  ];

  /**
   * Registers a custom or specialized document parser
   */
  public static registerParser(parser: DocumentParser): void {
    this.parsers.unshift(parser);
  }

  /**
   * Resolves the appropriate parser for a given filename and MIME type.
   * File extensions (.pdf, .md, .txt) take strict precedence to prevent
   * ambiguous or default MIME types (e.g. multipart/form-data text/plain)
   * from parsing binary formats incorrectly.
   */
  public static getParser(filename: string, mimeType?: string): DocumentParser {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
    
    // Strict extension-based resolution first
    for (const parser of this.parsers) {
      if (parser.supportedExtensions.includes(ext)) {
        return parser;
      }
    }

    const effectiveMime = mimeType || this.inferMimeType(filename);
    for (const parser of this.parsers) {
      if (parser.canParse(effectiveMime, filename)) {
        return parser;
      }
    }

    throw new Error(
      `Unsupported document format for "${filename}" (MIME: ${effectiveMime}). Supported formats: .pdf, .txt, .md`
    );
  }

  /**
   * Infers MIME type from filename extension
   */
  public static inferMimeType(filename: string): string {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
    switch (ext) {
      case ".pdf":
        return "application/pdf";
      case ".md":
      case ".markdown":
        return "text/markdown";
      case ".txt":
        return "text/plain";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Returns supported extensions list
   */
  public static getSupportedExtensions(): string[] {
    return [".pdf", ".txt", ".md", ".markdown"];
  }
}
