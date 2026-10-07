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
    new TextDocumentParser(),
    new MarkdownDocumentParser(),
    new PdfDocumentParser(),
  ];

  /**
   * Registers a custom or specialized document parser
   */
  public static registerParser(parser: DocumentParser): void {
    this.parsers.unshift(parser);
  }

  /**
   * Resolves the appropriate parser for a given filename and MIME type
   */
  public static getParser(filename: string, mimeType?: string): DocumentParser {
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
