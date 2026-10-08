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
import { AlertCircle, Loader2 } from "lucide-react";

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

  // Execution & results state
  const [candidatePool, setCandidatePool] =
    React.useState<CandidateChunkPool | null>(null);
  const [comparisonResult, setComparisonResult] =
    React.useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = React.useState<boolean>(false);
  const [comparisonProgress, setComparisonProgress] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Context Modal state
  const [contextModalPath, setContextModalPath] = React.useState<"a" | "b" | null>(null);

  // Check existing indexed documents on mount
  React.useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.totalChunksIndexed > 0) {
          setTotalIndexedChunks(data.totalChunksIndexed);
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
    if (!query.trim()) return;

    setIsComparing(true);
    setErrorMessage(null);

    try {
      // Step 1: Shared vector retrieval
      setComparisonProgress("Retrieving candidate passages...");
      const retrieveRes = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          topK,
        }),
      });

      const retrieveData = await retrieveRes.json();
      if (!retrieveRes.ok || !retrieveData.success) {
        throw new Error(
          retrieveData.error ||
            "Unable to retrieve candidates. Please ensure a document is uploaded first."
        );
      }

      const pool: CandidateChunkPool = retrieveData.pool;
      setCandidatePool(pool);

      // Step 2: Head-to-head comparison
      setComparisonProgress(
        "Evaluating candidate passages with Cross-Encoder & Laya, then generating answers..."
      );

      const compareRes = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          candidatePool: pool,
          mode,
          topN: mode === "context-budget" ? maxContextChunks : 5,
          maxContextChunks,
        }),
      });

      const compareData = await compareRes.json();
      if (!compareRes.ok || !compareData.success) {
        throw new Error(
          compareData.error ||
            "Comparison failed. Please ensure Ollama is running with llama3.2:3b."
        );
      }

      const comp: ComparisonResult = compareData.result;
      setComparisonResult(comp);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to evaluate the query. Please make sure Ollama and the required local workers are running.";
      setErrorMessage(msg);
    } finally {
      setIsComparing(false);
      setComparisonProgress(null);
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
            />

            {/* Loading Indicator during Comparison */}
            {isComparing && (
              <div className="p-4 rounded-lg border border-accent-border bg-accent-subtle/50 text-xs text-text-primary flex items-center gap-3 animate-in fade-in duration-150">
                <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-medium text-accent">
                    Evaluating candidate passages...
                  </div>
                  <p className="text-text-secondary text-[11px]">
                    {comparisonProgress ||
                      "Running Cross-Encoder and Laya relevance evaluators, then generating answers with llama3.2:3b."}
                  </p>
                </div>
              </div>
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
