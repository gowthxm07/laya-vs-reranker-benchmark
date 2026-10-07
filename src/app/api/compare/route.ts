import { NextRequest, NextResponse } from "next/server";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { ComparisonMode } from "@/lib/types/comparison";
import { RAGComparisonOrchestrator } from "@/server/services/rag-comparison-orchestrator";

export const dynamic = "force-dynamic";

/**
 * POST /api/compare
 * Executes a controlled head-to-head comparison between Path A (Cross-Encoder)
 * and Path B (Laya Relevance Filter) consuming the exact SAME candidate pool and LLM.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      candidatePool,
      mode = "native",
      topN = 5,
      maxContextChunks = 5,
      generationOptions,
    } = body as {
      query?: string;
      candidatePool?: CandidateChunkPool;
      mode?: ComparisonMode;
      topN?: number;
      maxContextChunks?: number;
      generationOptions?: {
        temperature?: number;
        seed?: number;
        topP?: number;
        maxTokens?: number;
      };
    };

    if (!candidatePool) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required 'candidatePool' payload for comparison.",
        },
        { status: 400 }
      );
    }

    const effectiveQuery = query || candidatePool.query;
    if (!effectiveQuery || !effectiveQuery.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Query cannot be empty for comparison benchmark.",
        },
        { status: 400 }
      );
    }

    if (
      !candidatePool.candidateChunks ||
      !Array.isArray(candidatePool.candidateChunks) ||
      candidatePool.candidateChunks.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "candidatePool must contain a non-empty array of candidateChunks.",
        },
        { status: 400 }
      );
    }

    const orchestrator = new RAGComparisonOrchestrator();

    const result = await orchestrator.compareCandidatePool(
      {
        ...candidatePool,
        query: effectiveQuery,
      },
      {
        mode,
        topN,
        maxContextChunks,
        generationOptions,
      }
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    console.error("Comparison execution error:", error);
    const message =
      error instanceof Error ? error.message : "Internal comparison failure";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
