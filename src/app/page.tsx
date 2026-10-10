"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DocumentIngestionCard } from "@/components/documents/document-ingestion-card";
import { QuerySection } from "@/components/query/query-section";
import { RelevanceEnginesSection } from "@/components/comparison/relevance-engines-section";
import { AnalyticsSection } from "@/components/comparison/analytics-section";
import { BenchmarkSuiteView } from "@/components/benchmark/benchmark-suite-view";
import { BenchmarkHistoryView } from "@/components/benchmark/benchmark-history-view";
import { ContextViewerModal } from "@/components/comparison/context-viewer-modal";
import { Document } from "@/lib/types/document";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { ComparisonResult, ComparisonMode } from "@/lib/types/comparison";
import { BenchmarkSuiteResult } from "@/lib/types/benchmark";
import { AlertCircle } from "lucide-react";
import {
  ComparisonProgressPanel,
  PipelineStageInfo,
  StageId,
  StageStatus,
} from "@/components/comparison/comparison-progress-panel";

const INITIAL_STAGES: PipelineStageInfo[] = [
  { id: "retrieval", label: "Retrieving relevant passages", status: "pending" },
  {
    id: "cross-encoder-eval",
    label: "Evaluating passages with Cross-Encoder",
    status: "pending",
  },
  {
    id: "laya-eval",
    label: "Evaluating passages with Laya",
    status: "pending",
  },
  {
    id: "context-prep",
    label: "Preparing context for both strategies",
    status: "pending",
  },
  {
    id: "cross-encoder-gen",
    label: "Generating the Cross-Encoder answer",
    status: "pending",
  },
  {
    id: "laya-gen",
    label: "Generating the Laya answer",
    status: "pending",
  },
  {
    id: "finalizing",
    label: "Finalizing comparison results",
    status: "pending",
  },
];

export default function HomePage() {
  // Navigation: primary "lab", secondary "benchmark", "history"
  const [activeTab, setActiveTab] = React.useState<"lab" | "benchmark" | "history">("lab");
  const [loadedBenchmarkResult, setLoadedBenchmarkResult] =
    React.useState<BenchmarkSuiteResult | null>(null);

  // Ingestion state
  const [indexedDoc, setIndexedDoc] = React.useState<Document | null>(null);
  const [totalIndexedChunks, setTotalIndexedChunks] = React.useState<number>(0);

  // Query state
  const [query, setQuery] = React.useState<string>(
    "What are the standard working hours?"
  );

  // Advanced options state (collapsed by default)
  const [mode, setMode] = React.useState<ComparisonMode>("native");
  const [topK, setTopK] = React.useState<number>(10);
  const [maxContextChunks, setMaxContextChunks] = React.useState<number>(5);
  const [layaThreshold, setLayaThreshold] = React.useState<number>(0.75);

  // Execution & results state
  const [candidatePool, setCandidatePool] =
    React.useState<CandidateChunkPool | null>(null);
  const [comparisonResult, setComparisonResult] =
    React.useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = React.useState<boolean>(false);
  const [stages, setStages] = React.useState<PipelineStageInfo[]>(INITIAL_STAGES);
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // References for live timer and request cancellation
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Context Modal state
  const [contextModalPath, setContextModalPath] = React.useState<"a" | "b" | null>(null);

  // Lifecycle cleanup
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedSeconds(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const updateStage = (
    id: StageId,
    status: StageStatus,
    options?: { detail?: string; errorMessage?: string }
  ) => {
    setStages((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status,
              detail: options?.detail !== undefined ? options.detail : s.detail,
              errorMessage:
                options?.errorMessage !== undefined
                  ? options.errorMessage
                  : s.errorMessage,
            }
          : s
      )
    );
  };

  // Check existing indexed documents on mount
  React.useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.totalChunksIndexed > 0) {
          setTotalIndexedChunks(data.totalChunksIndexed);
          if (data.documents && data.documents.length > 0) {
            const latestDoc = data.documents[data.documents.length - 1];
            const mimeType = latestDoc.filename.endsWith(".pdf")
              ? "application/pdf"
              : latestDoc.filename.endsWith(".md")
              ? "text/markdown"
              : "text/plain";
            setIndexedDoc({
              id: latestDoc.documentId,
              filename: latestDoc.filename,
              mimeType,
              size: 0,
              createdAt: Date.now(),
              pageCount: latestDoc.pageCount,
              chunkCount: latestDoc.chunkCount,
            });
          }
        } else {
          setTotalIndexedChunks(0);
          setIndexedDoc(null);
        }
      })
      .catch(() => {});
  }, []);

  const handleDocumentIngested = (doc: Document, chunkCount: number) => {
    setIndexedDoc(doc);
    setTotalIndexedChunks((prev) => prev + chunkCount);
    setCandidatePool(null);
    setComparisonResult(null);
  };

  const handleClearIndex = () => {
    setIndexedDoc(null);
    setTotalIndexedChunks(0);
    setCandidatePool(null);
    setComparisonResult(null);
  };

  const handleRunComparison = async () => {
    if (!query.trim() || isComparing) return;

    setIsComparing(true);
    setErrorMessage(null);
    setComparisonResult(null);

    // Initialize all stages with Stage 1 active
    setStages(
      INITIAL_STAGES.map((s, idx) =>
        idx === 0 ? { ...s, status: "running" } : { ...s, status: "pending" }
      )
    );
    startTimer();

    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Shared vector retrieval
      const retrieveRes = await fetch("/api/retrieve", {
        method: "POST",
        signal: abortControllerRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          topK,
        }),
      });

      const retrieveData = await retrieveRes.json();
      if (!retrieveRes.ok || !retrieveData.success) {
        const err =
          retrieveData.error ||
          "Unable to retrieve candidates. Please ensure a document is uploaded first.";
        updateStage("retrieval", "error", { errorMessage: err });
        throw new Error(err);
      }

      updateStage("retrieval", "completed");
      const pool: CandidateChunkPool = retrieveData.pool;
      setCandidatePool(pool);

      // Step 2: Head-to-head comparison with SSE streaming
      const compareRes = await fetch("/api/compare", {
        method: "POST",
        signal: abortControllerRef.current.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          query: query.trim(),
          candidatePool: pool,
          mode,
          topN: mode === "context-budget" ? maxContextChunks : 5,
          maxContextChunks,
          layaThreshold,
        }),
      });

      if (!compareRes.ok) {
        let errText = "Comparison request failed.";
        try {
          const errJson = await compareRes.json();
          errText = errJson.error || errText;
        } catch {
          // ignore
        }
        throw new Error(errText);
      }

      // If server returned streaming SSE response
      if (
        compareRes.headers.get("content-type")?.includes("text/event-stream") &&
        compareRes.body
      ) {
        const reader = compareRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            if (!block.trim()) continue;
            const eventMatch = block.match(/^event:\s*(.+)$/m);
            const dataMatch = block.match(/^data:\s*(.+)$/m);
            const eventName = eventMatch ? eventMatch[1].trim() : "message";
            const rawData = dataMatch ? dataMatch[1].trim() : "";

            if (!rawData) continue;
            let data: Record<string, unknown> = {};
            try {
              data = JSON.parse(rawData);
            } catch {
              continue;
            }

            if (eventName === "progress") {
              const notif = data as {
                type?: string;
                event?: {
                  phase?: string;
                  pipelineId?: string;
                  status?: string;
                  details?: { stageId?: string };
                  errorMessage?: string;
                };
              };
              const phase = notif.event?.phase;
              const pipelineId = notif.event?.pipelineId;
              const type = notif.type;
              const stageId = notif.event?.details?.stageId;

              // Map backend events to stages
              if (
                stageId === "cross-encoder-eval" ||
                (phase === "relevance_evaluation_started" &&
                  pipelineId === "advanced-rag")
              ) {
                updateStage("cross-encoder-eval", "running");
              } else if (
                phase === "relevance_evaluation_completed" &&
                pipelineId === "advanced-rag"
              ) {
                updateStage("cross-encoder-eval", "completed");
              } else if (
                stageId === "laya-eval" ||
                (phase === "relevance_evaluation_started" &&
                  pipelineId === "laya-rag")
              ) {
                updateStage("laya-eval", "running");
              } else if (
                phase === "relevance_evaluation_completed" &&
                pipelineId === "laya-rag"
              ) {
                updateStage("laya-eval", "completed");
              } else if (
                stageId === "context-prep" &&
                type === "phase:started"
              ) {
                updateStage("context-prep", "running");
              } else if (
                stageId === "context-prep" &&
                type === "phase:completed"
              ) {
                updateStage("context-prep", "completed");
              } else if (
                stageId === "cross-encoder-gen" &&
                type === "phase:started"
              ) {
                updateStage("cross-encoder-gen", "running");
              } else if (
                stageId === "cross-encoder-gen" &&
                type === "phase:completed"
              ) {
                updateStage("cross-encoder-gen", "completed");
              } else if (stageId === "laya-gen" && type === "phase:started") {
                updateStage("laya-gen", "running");
              } else if (stageId === "laya-gen" && type === "phase:completed") {
                updateStage("laya-gen", "completed");
              } else if (stageId === "finalizing") {
                updateStage("finalizing", "running");
              }
            } else if (eventName === "complete") {
              updateStage("finalizing", "completed");
              setComparisonResult(data.result as ComparisonResult);
            } else if (eventName === "error") {
              throw new Error(
                (data.error as string) || "Comparison execution failed."
              );
            }
          }
        }
      } else {
        // Fallback for standard JSON response
        const compareData = await compareRes.json();
        if (!compareData.success) {
          throw new Error(compareData.error || "Comparison failed.");
        }
        setStages(INITIAL_STAGES.map((s) => ({ ...s, status: "completed" })));
        setComparisonResult(compareData.result);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to evaluate the query. Please make sure Ollama and the required local workers are running.";
      setErrorMessage(msg);
      setStages((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "error" } : s))
      );
    } finally {
      setIsComparing(false);
      stopTimer();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text-primary selection:bg-accent-subtle selection:text-accent">
      {/* Minimal Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 w-full mx-auto px-4 sm:px-6 py-10 ${
          activeTab === "benchmark"
            ? "max-w-6xl"
            : activeTab === "history"
            ? "max-w-5xl"
            : "max-w-4xl space-y-14"
        }`}
      >
        {activeTab === "history" ? (
          <BenchmarkHistoryView
            onLoadRunToDashboard={(res) => {
              setLoadedBenchmarkResult(res);
              setActiveTab("benchmark");
            }}
            onNavigateToBenchmark={() => setActiveTab("benchmark")}
          />
        ) : activeTab === "benchmark" ? (
          <BenchmarkSuiteView
            initialResult={loadedBenchmarkResult}
            onResultChange={setLoadedBenchmarkResult}
          />
        ) : (
          <>
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg border border-status-error/30 bg-rose-50 text-xs text-rose-800 flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-status-error" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-xs text-rose-600 hover:text-rose-900 underline font-mono shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Section 01 — DOCUMENT */}
            <DocumentIngestionCard
              indexedDoc={indexedDoc}
              totalChunks={totalIndexedChunks}
              onDocumentIngested={handleDocumentIngested}
              onClearIndex={handleClearIndex}
            />

            {/* Section 02 — QUERY */}
            <QuerySection
              query={query}
              onChangeQuery={setQuery}
              onRunComparison={handleRunComparison}
              isComparing={isComparing}
              mode={mode}
              onChangeMode={setMode}
              topK={topK}
              onChangeTopK={setTopK}
              maxContextChunks={maxContextChunks}
              onChangeMaxContextChunks={setMaxContextChunks}
              layaThreshold={layaThreshold}
              onChangeLayaThreshold={setLayaThreshold}
            />

            {/* Live Progress Feedback Panel during Comparison */}
            {isComparing && (
              <ComparisonProgressPanel
                stages={stages}
                elapsedSeconds={elapsedSeconds}
              />
            )}

            {/* Section 03 — RELEVANCE ENGINES */}
            <RelevanceEnginesSection
              comparisonResult={comparisonResult}
              candidatePool={candidatePool}
              onViewCrossEncoderPassages={() => setContextModalPath("a")}
              onViewLayaPassages={() => setContextModalPath("b")}
            />

            {/* Section 04 — ANALYTICS */}
            <AnalyticsSection
              comparisonResult={comparisonResult}
              onOpenContextViewer={setContextModalPath}
            />
          </>
        )}
      </main>

      {/* Global Minimal Footer */}
      <Footer />

      {/* Context Viewer Modal */}
      {contextModalPath && comparisonResult && (
        <ContextViewerModal
          isOpen={!!contextModalPath}
          onClose={() => setContextModalPath(null)}
          strategyTitle={
            contextModalPath === "a"
              ? "Cross-Encoder (ms-marco-MiniLM-L-6-v2)"
              : "Laya Relevance Filter"
          }
          chunks={
            contextModalPath === "a"
              ? comparisonResult.crossEncoder.selectedChunks
              : comparisonResult.laya.selectedChunks
          }
          contextText={
            contextModalPath === "a"
              ? comparisonResult.crossEncoder.contextText
              : comparisonResult.laya.contextText
          }
        />
      )}
    </div>
  );
}
