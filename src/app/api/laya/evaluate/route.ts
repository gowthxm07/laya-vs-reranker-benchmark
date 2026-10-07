import { NextRequest, NextResponse } from "next/server";
import { LayaRelevanceFilteringService } from "@/server/services/laya-filtering-service";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { Chunk } from "@/lib/types/chunk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      candidatePool,
      candidateChunks,
    }: {
      query?: string;
      candidatePool?: CandidateChunkPool;
      candidateChunks?: Chunk[];
    } = body;

    let pool: CandidateChunkPool;

    if (candidatePool && candidatePool.candidateChunks) {
      pool = candidatePool;
    } else if (candidateChunks && Array.isArray(candidateChunks)) {
      if (!query || !query.trim()) {
        return NextResponse.json(
          { error: "Query is required when supplying candidateChunks directly." },
          { status: 400 }
        );
      }
      pool = {
        id: `pool_adhoc_laya_${Date.now()}`,
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

    const filteringService = new LayaRelevanceFilteringService();
    const filteredPool = await filteringService.filterPool(pool);

    return NextResponse.json({
      success: true,
      query: filteredPool.query,
      candidateCount: filteredPool.totalCandidates,
      retainedCount: filteredPool.retainedCount,
      discardedCount: filteredPool.discardedCount,
      contextReductionPercent: filteredPool.contextReductionPercent,
      layaModel: filteredPool.layaModel,
      filteredPool,
      metrics: filteredPool.metrics,
    });
  } catch (err: unknown) {
    console.error("Laya relevance evaluation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to execute Laya relevance evaluation.",
      },
      { status: 500 }
    );
  }
}
