import { DocumentParser, ParseOptions } from "../interfaces/document-parser";
import { ParsedDocument } from "../types/document";

export class TextDocumentParser implements DocumentParser {
  readonly supportedMimeTypes = ["text/plain"];
  readonly supportedExtensions = [".txt"];

  canParse(mimeType: string, filename: string): boolean {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
    if (ext === ".pdf" || ext === ".md" || ext === ".markdown") {
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
      throw new Error(`Text document "${filename}" contains no extractable content.`);
    }

    const documentId =
      options?.documentId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return {
      documentId,
      filename,
      mimeType: "text/plain",
      text: cleanedText,
      pages: [{ pageNumber: 1, text: cleanedText }],
      pageCount: 1,
      metadata: options?.metadata,
    };
  }
}
