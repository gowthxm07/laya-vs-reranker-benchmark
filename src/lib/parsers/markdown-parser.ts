import { DocumentParser, ParseOptions } from "../interfaces/document-parser";
import { ParsedDocument } from "../types/document";

export class MarkdownDocumentParser implements DocumentParser {
  readonly supportedMimeTypes = ["text/markdown", "text/x-markdown"];
  readonly supportedExtensions = [".md", ".markdown"];

  canParse(mimeType: string, filename: string): boolean {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
    if (ext === ".pdf") {
      return false;
    }
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(ext)
    );
  }

  async parse(
    buffer: Buffer,
    filename: string,
    options?: ParseOptions
  ): Promise<ParsedDocument> {
    const rawText = buffer.toString("utf-8");
    const cleanedText = rawText.replace(/\r\n/g, "\n").trim();

    if (!cleanedText) {
      throw new Error(`Markdown document "${filename}" contains no extractable content.`);
    }

    const documentId =
      options?.documentId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return {
      documentId,
      filename,
      mimeType: "text/markdown",
      text: cleanedText,
      pages: [{ pageNumber: 1, text: cleanedText }],
      pageCount: 1,
      metadata: options?.metadata,
    };
  }
}
