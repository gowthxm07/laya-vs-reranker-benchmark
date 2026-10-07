import { NextRequest, NextResponse } from "next/server";
import { DocumentIngestionService } from "@/server/services/ingestion-service";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const ingestionService = new DocumentIngestionService();

    // 1. Multipart Form Data (File Upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided in request." },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = file.name;
      const mimeType = file.type;

      const result = await ingestionService.ingestDocument(
        buffer,
        filename,
        mimeType
      );

      return NextResponse.json({
        success: true,
        document: result.document,
        chunkCount: result.chunkCount,
        timings: result.timings,
      });
    }

    // 2. JSON Body (Text or Markdown payload)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { text, filename = "document.txt", mimeType = "text/plain" } = body;

      if (!text || typeof text !== "string" || !text.trim()) {
        return NextResponse.json(
          { error: "Field 'text' is required and must not be empty." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(text, "utf-8");
      const result = await ingestionService.ingestDocument(
        buffer,
        filename,
        mimeType
      );

      return NextResponse.json({
        success: true,
        document: result.document,
        chunkCount: result.chunkCount,
        timings: result.timings,
      });
    }

    return NextResponse.json(
      { error: "Unsupported Content-Type. Use multipart/form-data or application/json." },
      { status: 415 }
    );
  } catch (err) {
    console.error("Document ingestion error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to ingest document.",
      },
      { status: 500 }
    );
  }
}
