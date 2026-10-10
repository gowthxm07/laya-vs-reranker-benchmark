import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DocumentIngestionService } from "@/server/services/ingestion-service";
import { getGlobalVectorStore } from "@/lib/vector-store/local-vector-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/security-experiment/load-preset
 * Ingests the synthetic demo_document_security.pdf from the workspace root
 * into the local vector store for live security experimentation.
 */
export async function POST() {
  try {
    const pdfPath = path.join(process.cwd(), "demo_document_security.pdf");
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { success: false, error: "demo_document_security.pdf was not found in the project root." },
        { status: 404 }
      );
    }

    const vectorStore = getGlobalVectorStore();
    const existingSummaries = await vectorStore.getIndexedDocumentsSummary();
    const existingSecDoc = existingSummaries.find(
      (d) => d.filename === "demo_document_security.pdf" || d.documentId === "demo_document_security.pdf"
    );

    if (existingSecDoc && existingSecDoc.chunkCount > 0) {
      return NextResponse.json({
        success: true,
        alreadyIndexed: true,
        document: {
          documentId: existingSecDoc.documentId,
          filename: existingSecDoc.filename,
          chunkCount: existingSecDoc.chunkCount,
          pageCount: existingSecDoc.pageCount || 11,
        },
      });
    }

    // Ingest the security PDF
    const fileBuffer = fs.readFileSync(pdfPath);
    const ingestionService = new DocumentIngestionService();
    const result = await ingestionService.ingestDocument(
      fileBuffer,
      "demo_document_security.pdf",
      "application/pdf"
    );

    return NextResponse.json({
      success: true,
      alreadyIndexed: false,
      document: {
        documentId: result.document.id,
        filename: result.document.filename,
        chunkCount: result.chunkCount,
        pageCount: result.document.pageCount || 11,
      },
      timings: result.timings,
    });
  } catch (error: unknown) {
    console.error("Failed to load demo_document_security.pdf:", error);
    const message = error instanceof Error ? error.message : "Failed to load security PDF";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
