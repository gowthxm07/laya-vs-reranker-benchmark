import { NextRequest, NextResponse } from "next/server";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { ComparisonMode } from "@/lib/types/comparison";
import { RAGComparisonOrchestrator } from "@/server/services/rag-comparison-orchestrator";
import { PipelineNotification, IPipelineObserver } from "@/lib/interfaces/observer";

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
      layaThreshold,
      generationOptions,
    } = body as {
      query?: string;
      candidatePool?: CandidateChunkPool;
      mode?: ComparisonMode;
      topN?: number;
      maxContextChunks?: number;
      layaThreshold?: number;
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

    const isStreamingRequested =
      req.headers.get("accept")?.includes("text/event-stream") ||
      req.nextUrl.searchParams.get("stream") === "true";

    const orchestrator = new RAGComparisonOrchestrator();

    if (isStreamingRequested) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          let isClosed = false;

          const sendEvent = (event: string, data: unknown) => {
            if (isClosed) return;
            try {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                )
              );
            } catch {
              isClosed = true;
            }
          };

          const observerId = `sse_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const observer: IPipelineObserver = {
            id: observerId,
            onEvent(notification: PipelineNotification) {
              sendEvent("progress", {
                type: notification.type,
                event: notification.event,
              });
            },
          };

          orchestrator.getObservable().addObserver(observer);

          try {
            const result = await orchestrator.compareCandidatePool(
              {
                ...candidatePool,
                query: effectiveQuery,
              },
              {
                mode,
                topN,
                maxContextChunks,
                layaThreshold,
                generationOptions,
              }
            );
            sendEvent("complete", { success: true, result });
          } catch (err: unknown) {
            const message =
              err instanceof Error
                ? err.message
                : "Internal comparison failure";
            sendEvent("error", { success: false, error: message });
          } finally {
            orchestrator.getObservable().removeObserver(observerId);
            if (!isClosed) {
              try {
                controller.close();
              } catch {
                // Ignore
              }
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const result = await orchestrator.compareCandidatePool(
      {
        ...candidatePool,
        query: effectiveQuery,
      },
      {
        mode,
        topN,
        maxContextChunks,
        layaThreshold,
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
