import { NextRequest, NextResponse } from "next/server";
import { SharedRetrieverService } from "@/server/services/retriever-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, topK = 10, similarityThreshold, documentId } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Query is required and must not be empty." },
        { status: 400 }
      );
    }

    const retriever = new SharedRetrieverService();
    const pool = await retriever.retrieve(query, {
      topK: Number(topK) || 10,
      similarityThreshold:
        similarityThreshold !== undefined
          ? Number(similarityThreshold)
          : undefined,
      documentId,
    });

    return NextResponse.json({
      success: true,
      pool,
    });
  } catch (err) {
    console.error("Retrieval error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to execute retrieval." },
      { status: 500 }
    );
  }
}
