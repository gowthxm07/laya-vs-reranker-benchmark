import { NextRequest, NextResponse } from "next/server";
import { CrossEncoderRerankingService } from "@/server/services/cross-encoder-reranking-service";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { Chunk } from "@/lib/types/chunk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      candidatePool,
      candidateChunks,
      topN = 5,
    }: {
      query?: string;
      candidatePool?: CandidateChunkPool;
      candidateChunks?: Chunk[];
      topN?: number;
    } = body;

    // Build or extract candidate pool
    let pool: CandidateChunkPool;
    if (candidatePool && candidatePool.candidateChunks) {
      pool = candidatePool;
    } else if (candidateChunks && Array.isArray(candidateChunks)) {
      if (!query || !query.trim()) {
        return NextResponse.json(
          { error: "Query is required when providing candidateChunks directly." },
          { status: 400 }
        );
      }
      pool = {
        id: `pool_adhoc_${Date.now()}`,
        query: query.trim(),
        retrievedAt: Date.now(),
        candidateChunks,
        totalCandidates: candidateChunks.length,
        retrievalConfig: {
          topK: candidateChunks.length,
          embeddingModel: "nomic-embed-text",
        },
        embeddingModel: "nomic-embed-text",
        retrievalLatencyMs: 0,
      };
    } else {
      return NextResponse.json(
        {
          error:
            "Either 'candidatePool' or 'candidateChunks' must be provided in request body.",
        },
        { status: 400 }
      );
    }

    const rerankingService = new CrossEncoderRerankingService();
    const rerankedPool = await rerankingService.rerankPool(pool, {
      topN: Number(topN) || 5,
    });

    return NextResponse.json({
      success: true,
      query: rerankedPool.query,
      candidateCount: rerankedPool.topKRetrieved,
      topNSelected: rerankedPool.topNSelected,
      crossEncoderModel: rerankedPool.crossEncoderModel,
      rerankedPool,
      metrics: rerankedPool.metrics,
    });
  } catch (err: unknown) {
    console.error("Cross-Encoder reranking error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to execute cross-encoder reranking.",
      },
      { status: 500 }
    );
  }
}
