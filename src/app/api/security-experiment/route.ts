import { NextRequest, NextResponse } from "next/server";
import {
  SecurityExperimentMode,
  UserRole,
} from "@/lib/types/security-experiment";
import {
  SYNTHETIC_SECURITY_CHUNKS,
  SECURITY_TEST_CASES,
} from "@/lib/security-experiment/synthetic-confidential-dataset";
import { SecurityExperimentOrchestrator } from "@/server/services/security-experiment-orchestrator";
import { SharedRetrieverService } from "@/server/services/retriever-service";
import { getGlobalVectorStore } from "@/lib/vector-store/local-vector-store";
import { DocumentIngestionService } from "@/server/services/ingestion-service";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

/**
 * POST /api/security-experiment
 * Executes live security comparison between:
 * Path A: Cross-Encoder RAG + Conventional Guardrails
 * Path B: Laya RAG + Laya-Specific Security Instructions Only
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      testCaseId,
      query,
      mode,
      simulatedRole,
      layaThreshold = 0.75,
      topN = 5,
      topK = 10,
      documentId,
    } = body as {
      testCaseId?: string;
      query?: string;
      mode?: SecurityExperimentMode;
      simulatedRole?: UserRole;
      layaThreshold?: number;
      topN?: number;
      topK?: number;
      documentId?: string;
    };

    // If explicit legacy testCaseId or legacy mode is supplied without a live document query, run legacy test harness
    if (testCaseId && !documentId && mode) {
      const testCase = SECURITY_TEST_CASES.find((tc) => tc.id === testCaseId);
      const effectiveQuery = (query || testCase?.query || "What are the standard working hours?").trim();
      const effectiveRole: UserRole = simulatedRole || testCase?.simulatedRole || "employee";
      const candidatePool = SYNTHETIC_SECURITY_CHUNKS;

      const orchestrator = new SecurityExperimentOrchestrator();
      const result = await orchestrator.executeExperiment({
        testCase,
        query: effectiveQuery,
        candidatePool,
        mode,
        simulatedRole: effectiveRole,
        layaThreshold,
        topN,
      });

      return NextResponse.json({
        success: true,
        result,
      });
    }

    // Phase 3 Live Path A vs Path B comparison on real retrieved documents
    const effectiveQuery = (query || "What are the standard working hours?").trim();
    const effectiveRole: UserRole | undefined = simulatedRole || undefined;

    const isStreamingRequested =
      req.headers.get("accept")?.includes("text/event-stream") ||
      req.nextUrl.searchParams.get("stream") === "true";

    const vectorStore = getGlobalVectorStore();

    if (isStreamingRequested) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let isClosed = false;
          const sendEvent = (event: string, data: unknown) => {
            if (isClosed) return;
            try {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
              );
            } catch {
              isClosed = true;
            }
          };

          try {
            sendEvent("progress", {
              stageId: "initialization",
              status: "running",
              label: "Request submitted / initialization",
            });

            // If no document exists in the vector store, auto-ingest demo_document_security.pdf
            const indexedSummaries = await vectorStore.getIndexedDocumentsSummary();
            if (indexedSummaries.length === 0) {
              const secPdfPath = path.join(process.cwd(), "demo_document_security.pdf");
              if (fs.existsSync(secPdfPath)) {
                const fileBuffer = fs.readFileSync(secPdfPath);
                const ingestionService = new DocumentIngestionService();
                await ingestionService.ingestDocument(
                  fileBuffer,
                  "demo_document_security.pdf",
                  "application/pdf"
                );
              }
            }

            sendEvent("progress", {
              stageId: "initialization",
              status: "completed",
              label: "Request submitted / initialization",
            });

            sendEvent("progress", {
              stageId: "retrieval",
              status: "running",
              label: "Document verification and candidate retrieval",
            });

            // Determine target document
            const refreshedSummaries = await vectorStore.getIndexedDocumentsSummary();
            let targetDocId = documentId;
            let targetDocName = "Uploaded Document";

            if (targetDocId) {
              const match = refreshedSummaries.find((d) => d.documentId === targetDocId);
              if (match) targetDocName = match.filename;
            } else if (refreshedSummaries.length > 0) {
              const secDoc = refreshedSummaries.find((d) => d.filename.includes("security"));
              if (secDoc) {
                targetDocId = secDoc.documentId;
                targetDocName = secDoc.filename;
              } else {
                const latest = refreshedSummaries[refreshedSummaries.length - 1];
                targetDocId = latest.documentId;
                targetDocName = latest.filename;
              }
            }

            // Retrieve live candidates from vector store
            const retriever = new SharedRetrieverService(vectorStore);
            const candidatePool = await retriever.retrieve(effectiveQuery, {
              topK,
              documentId: targetDocId,
            });

            sendEvent("progress", {
              stageId: "retrieval",
              status: "completed",
              label: "Document verification and candidate retrieval",
            });

            const orchestrator = new SecurityExperimentOrchestrator();
            const result = await orchestrator.executeLiveComparison(
              {
                query: effectiveQuery,
                candidatePool: candidatePool.candidateChunks,
                simulatedRole: effectiveRole,
                topN,
                layaThreshold,
                documentId: targetDocId,
                documentName: targetDocName,
              },
              (progressEvent) => {
                sendEvent("progress", progressEvent);
              }
            );

            sendEvent("complete", { success: true, result });
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            sendEvent("error", { success: false, error: errorMsg });
          } finally {
            if (!isClosed) {
              try {
                controller.close();
              } catch {
                // ignore
              }
              isClosed = true;
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

    // Standard synchronous JSON execution
    const indexedSummaries = await vectorStore.getIndexedDocumentsSummary();
    if (indexedSummaries.length === 0) {
      const secPdfPath = path.join(process.cwd(), "demo_document_security.pdf");
      if (fs.existsSync(secPdfPath)) {
        const fileBuffer = fs.readFileSync(secPdfPath);
        const ingestionService = new DocumentIngestionService();
        await ingestionService.ingestDocument(
          fileBuffer,
          "demo_document_security.pdf",
          "application/pdf"
        );
      }
    }

    // Determine target document
    const refreshedSummaries = await vectorStore.getIndexedDocumentsSummary();
    let targetDocId = documentId;
    let targetDocName = "Uploaded Document";

    if (targetDocId) {
      const match = refreshedSummaries.find((d) => d.documentId === targetDocId);
      if (match) targetDocName = match.filename;
    } else if (refreshedSummaries.length > 0) {
      const secDoc = refreshedSummaries.find((d) => d.filename.includes("security"));
      if (secDoc) {
        targetDocId = secDoc.documentId;
        targetDocName = secDoc.filename;
      } else {
        const latest = refreshedSummaries[refreshedSummaries.length - 1];
        targetDocId = latest.documentId;
        targetDocName = latest.filename;
      }
    }

    // Retrieve live candidates from vector store
    const retriever = new SharedRetrieverService(vectorStore);
    const candidatePool = await retriever.retrieve(effectiveQuery, {
      topK,
      documentId: targetDocId,
    });

    const orchestrator = new SecurityExperimentOrchestrator();
    const result = await orchestrator.executeLiveComparison({
      query: effectiveQuery,
      candidatePool: candidatePool.candidateChunks,
      simulatedRole: effectiveRole,
      topN,
      layaThreshold,
      documentId: targetDocId,
      documentName: targetDocName,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    console.error("Security experiment API error:", error);
    const message = error instanceof Error ? error.message : "Internal security experiment error";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
