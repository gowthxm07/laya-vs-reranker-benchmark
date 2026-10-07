"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DocumentIngestionCard } from "@/components/documents/document-ingestion-card";
import { BenchmarkControlBar } from "@/components/query/benchmark-control-bar";
import { CandidatePoolInspector } from "@/components/retrieval/candidate-pool-inspector";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";
import { DesignPatternInspector } from "@/components/patterns/design-pattern-inspector";
import { SAMPLE_DATASETS } from "@/lib/config/datasets";
import { DocumentDataset } from "@/lib/types/dataset";
import { Document } from "@/lib/types/document";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { Experiment } from "@/lib/types/experiment";
import { Terminal, Cpu, AlertCircle } from "lucide-react";

export default function HomePage() {
  const [selectedDataset, setSelectedDataset] = React.useState<DocumentDataset>(
    SAMPLE_DATASETS[0]
  );
  const [query, setQuery] = React.useState<string>(
    "What attention mechanism mitigates quadratic complexity in long-context models?"
  );
  const [topK, setTopK] = React.useState<number>(10);
  const [isPatternModalOpen, setIsPatternModalOpen] = React.useState(false);
  const [runNotice, setRunNotice] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Ingestion state
  const [indexedDoc, setIndexedDoc] = React.useState<Document | null>(null);
  const [totalIndexedChunks, setTotalIndexedChunks] = React.useState<number>(0);

  // Retrieval state: real CandidateChunkPool from vector store
  const [candidatePool, setCandidatePool] =
    React.useState<CandidateChunkPool | null>(null);
  const [isRetrieving, setIsRetrieving] = React.useState<boolean>(false);

  // Initial experiment model
  const [currentExperiment, setCurrentExperiment] = React.useState<Experiment>({
    id: "exp-init",
    query: "",
    dataset: SAMPLE_DATASETS[0],
    timestamp: Date.now(),
    status: "idle",
    advancedRagResult: {
      pipelineId: "advanced-rag",
      strategyName: "Cross-Encoder Reranker",
      status: "idle",
    },
    layaResult: {
      pipelineId: "laya-rag",
      strategyName: "Laya Relevance Filter",
      status: "idle",
    },
  });

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
    setRunNotice(
      `Successfully ingested and indexed "${doc.filename}" into vector store (${chunkCount} chunks generated with nomic-embed-text).`
    );
  };

  const handleClearIndex = () => {
    setIndexedDoc(null);
    setTotalIndexedChunks(0);
    setCandidatePool(null);
    setRunNotice("Vector store cleared.");
  };

  const handleRetrieveCandidates = async () => {
    if (!query.trim()) return;

    setIsRetrieving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          topK,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Retrieval failed.");
      }

      const pool: CandidateChunkPool = data.pool;
      setCandidatePool(pool);

      // Update experiment object with real candidate count and retrieval latency
      setCurrentExperiment((prev) => ({
        ...prev,
        query: query.trim(),
        dataset: selectedDataset,
        timestamp: Date.now(),
        advancedRagResult: {
          pipelineId: "advanced-rag",
          strategyName: "Cross-Encoder Reranker",
          status: "idle",
          candidateChunkCount: pool.totalCandidates,
          retrievalLatencyMs: pool.retrievalLatencyMs,
        },
        layaResult: {
          pipelineId: "laya-rag",
          strategyName: "Laya Relevance Filter",
          status: "idle",
          candidateChunkCount: pool.totalCandidates,
          retrievalLatencyMs: pool.retrievalLatencyMs,
        },
      }));

      setRunNotice(
        `Retrieved ${pool.candidateChunks.length} candidate passages in ${pool.retrievalLatencyMs}ms using nomic-embed-text. Candidate pool prepared for future Cross-Encoder and Laya evaluation.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to retrieve candidate chunks.";
      setErrorMessage(message);
    } finally {
      setIsRetrieving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text-primary selection:bg-accent-subtle selection:text-accent">
      {/* Global Header */}
      <Header onOpenArchitectureModal={() => setIsPatternModalOpen(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Notice Banners */}
        {runNotice && (
          <div className="p-3 rounded border border-accent/40 bg-accent-subtle/30 text-xs text-text-primary flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent shrink-0" />
              <span>{runNotice}</span>
            </div>
            <button
              onClick={() => setRunNotice(null)}
              className="text-text-muted hover:text-text-primary text-xs font-mono underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded border border-status-error/40 bg-status-error/10 text-xs text-rose-300 flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-status-error" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-text-muted hover:text-rose-200 text-xs font-mono underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Document Ingestion Card (Phase 2 Component) */}
        <DocumentIngestionCard
          indexedDoc={indexedDoc}
          totalChunks={totalIndexedChunks}
          onDocumentIngested={handleDocumentIngested}
          onClearIndex={handleClearIndex}
        />

        {/* 2. Benchmark Query & Top-K Retrieval Control Bar */}
        <BenchmarkControlBar
          selectedDataset={selectedDataset}
          onSelectDataset={(ds) => {
            setSelectedDataset(ds);
            setCurrentExperiment((prev) => ({ ...prev, dataset: ds }));
          }}
          query={query}
          onChangeQuery={setQuery}
          topK={topK}
          onChangeTopK={setTopK}
          onRetrieveCandidates={handleRetrieveCandidates}
          isRunning={isRetrieving}
        />

        {/* 3. Shared Candidate Chunk Pool Inspector (Phase 2 Foundation) */}
        <CandidatePoolInspector
          pool={candidatePool}
          isLoading={isRetrieving}
        />

        {/* 4. Side-by-Side Comparison Workspace (Phase 3/4 Boundary) */}
        <ComparisonWorkspace experiment={currentExperiment} />

        {/* 5. Differential Metrics Dashboard */}
        <MetricsDashboard experiment={currentExperiment} />

        {/* 6. Architecture Foundation Card */}
        <section className="rounded-lg border border-border bg-surface-elevated/20 p-4 sm:p-5 text-xs">
          <div className="flex items-center gap-2 text-text-secondary font-medium mb-2">
            <Cpu className="h-4 w-4 text-accent" />
            <h3 className="text-text-primary font-semibold">
              Phase 2 Shared Retrieval Architecture
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-text-muted leading-relaxed">
            <div>
              <strong className="text-text-secondary block mb-0.5">
                1. Single Source of Truth Candidate Pool
              </strong>
              Vector retrieval produces a unified `CandidateChunkPool`. Both future pipelines (Path A Cross-Encoder and Path B Laya) receive this exact pool with identical initial ranks and scores.
            </div>
            <div>
              <strong className="text-text-secondary block mb-0.5">
                2. Real Local Embeddings (Ollama)
              </strong>
              Chunks and queries are embedded locally using `nomic-embed-text` (768 dimensions), avoiding cloud API fees and ensuring 100% reproducible local execution.
            </div>
            <div>
              <strong className="text-text-secondary block mb-0.5">
                3. Zero Premature Filtering
              </strong>
              The retriever assigns `decision: &quot;pending&quot;` to all candidates. It does NOT decide final relevance, preserving the post-retrieval boundary for the Strategy pattern.
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Software Design Patterns Inspector Modal */}
      <DesignPatternInspector
        isOpen={isPatternModalOpen}
        onClose={() => setIsPatternModalOpen(false)}
      />
    </div>
  );
}
