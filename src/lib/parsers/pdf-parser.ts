import { DocumentParser, ParseOptions } from "../interfaces/document-parser";
import { ParsedDocument, ParsedDocumentPage } from "../types/document";

export class PdfDocumentParser implements DocumentParser {
  readonly supportedMimeTypes = ["application/pdf", "application/x-pdf"];
  readonly supportedExtensions = [".pdf"];

  canParse(mimeType: string, filename: string): boolean {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
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
    if (!buffer || buffer.length === 0) {
      throw new Error(`PDF file "${filename}" is empty.`);
    }

    let pdfModule: Record<string, unknown>;
    try {
      pdfModule = (await import("pdf-parse")) as Record<string, unknown>;
    } catch (importErr) {
      throw new Error(
        `Failed to load PDF extraction library: ${importErr instanceof Error ? importErr.message : String(importErr)}`
      );
    }

    const PDFParse = (pdfModule.PDFParse ||
      (pdfModule.default as Record<string, unknown>)?.PDFParse ||
      pdfModule.default) as new (options: { data: Buffer }) => {
      getText: () => Promise<{ pages?: Array<{ num?: number; text?: string }>; total?: number }>;
      destroy?: () => Promise<void>;
    };
    if (!PDFParse) {
      throw new Error("PDFParse constructor not found in pdf-parse module.");
    }

    const parserInstance = new PDFParse({ data: buffer });
    try {
      const parsedResult = await parserInstance.getText();
      const rawPages = parsedResult?.pages || [];
      const totalPages = parsedResult?.total || rawPages.length || 1;

      const pages: ParsedDocumentPage[] = [];
      let combinedText = "";

      for (let i = 0; i < rawPages.length; i++) {
        const pageItem = rawPages[i];
        const pageNum = pageItem.num ?? i + 1;
        const pageText = (pageItem.text || "").trim();

        if (pageText) {
          pages.push({
            pageNumber: pageNum,
            text: pageText,
          });
          combinedText += (combinedText ? "\n\n" : "") + pageText;
        }
      }

      if (pages.length === 0 || !combinedText.trim()) {
        throw new Error(
          `PDF document "${filename}" contains no extractable text. Scanned or image-only PDFs are not supported.`
        );
      }

      const documentId =
        options?.documentId ||
        `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      return {
        documentId,
        filename,
        mimeType: "application/pdf",
        text: combinedText,
        pages,
        pageCount: totalPages,
        metadata: options?.metadata,
      };
    } finally {
      if (typeof parserInstance.destroy === "function") {
        await parserInstance.destroy().catch(() => {});
      }
    }
  }
}
