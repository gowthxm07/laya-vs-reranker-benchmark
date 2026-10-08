"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DocumentIngestionCard } from "@/components/documents/document-ingestion-card";
import { BenchmarkControlBar } from "@/components/query/benchmark-control-bar";
import { CandidatePoolInspector } from "@/components/retrieval/candidate-pool-inspector";
import { RerankedPoolInspector } from "@/components/reranking/reranked-pool-inspector";
import { LayaFilteredPoolInspector } from "@/components/laya/laya-filtered-pool-inspector";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import { BenchmarkSuiteView } from "@/components/benchmark/benchmark-suite-view";
import { BenchmarkHistoryView } from "@/components/benchmark/benchmark-history-view";
import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";
import { DesignPatternInspector } from "@/components/patterns/design-pattern-inspector";
import { SAMPLE_DATASETS } from "@/lib/config/datasets";
import { DocumentDataset } from "@/lib/types/dataset";
import { Document } from "@/lib/types/document";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { RerankedCandidatePool } from "@/lib/types/reranker";
import { LayaFilteredPool } from "@/lib/types/laya";
import { ComparisonResult, ComparisonMode } from "@/lib/types/comparison";
import { BenchmarkSuiteResult } from "@/lib/types/benchmark";
import { Experiment } from "@/lib/types/experiment";
import { Terminal, Cpu, AlertCircle, BarChart3, Compass, History } from "lucide-react";

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

  // Phase 3 Reranking state: real RerankedCandidatePool from Cross-Encoder
  const [rerankedPool, setRerankedPool] =
    React.useState<RerankedCandidatePool | null>(null);
  const [isReranking, setIsReranking] = React.useState<boolean>(false);
  const [rerankTopN, setRerankTopN] = React.useState<number>(5);

  // Phase 4 Laya state: real LayaFilteredPool from Laya relevance evaluation
  const [layaPool, setLayaPool] = React.useState<LayaFilteredPool | null>(null);
  const [isFilteringLaya, setIsFilteringLaya] = React.useState<boolean>(false);

  // Phase 5 Comparison state: real side-by-side comparison result with same LLM
  const [comparisonResult, setComparisonResult] =
    React.useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = React.useState<boolean>(false);

  // View Navigation: 3-tier IA: "lab", "benchmark", "history"
  const [activeTab, setActiveTab] = React.useState<"lab" | "benchmark" | "history">("lab");
  const [loadedBenchmarkResult, setLoadedBenchmarkResult] =
    React.useState<BenchmarkSuiteResult | null>(null);

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
    setRerankedPool(null);
    setLayaPool(null);
    setComparisonResult(null);
    setRunNotice("Vector store cleared.");
  };

  const handleRetrieveCandidates = async () => {
    if (!query.trim()) return;

    setIsRetrieving(true);
    setErrorMessage(null);
    setRerankedPool(null);
    setLayaPool(null);

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
        `Retrieved ${pool.candidateChunks.length} candidate passages in ${pool.retrievalLatencyMs}ms using nomic-embed-text. Candidate pool prepared for Cross-Encoder and Laya evaluation.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to retrieve candidate chunks.";
      setErrorMessage(message);
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleRunRerank = async (selectedTopN: number) => {
    if (!candidatePool || candidatePool.candidateChunks.length === 0) return;

    setIsReranking(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/rerank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidatePool,
          topN: selectedTopN,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Cross-Encoder reranking failed.");
      }

      const pool: RerankedCandidatePool = data.rerankedPool;
      setRerankedPool(pool);

      // Update Path A in current experiment
      setCurrentExperiment((prev) => ({
        ...prev,
        advancedRagResult: {
          pipelineId: "advanced-rag",
          strategyName: "Cross-Encoder Reranker",
          status: "completed",
          candidateChunkCount: pool.topKRetrieved,
          retainedChunkCount: pool.topNSelected,
          discardedChunkCount: pool.topKRetrieved - pool.topNSelected,
          retrievalLatencyMs: candidatePool.retrievalLatencyMs,
          relevanceEvaluationLatencyMs: pool.metrics.evaluationLatencyMs,
          totalLatencyMs:
            candidatePool.retrievalLatencyMs + pool.metrics.evaluationLatencyMs,
          retainedChunks: pool.selectedCandidates.map((c) => ({
            id: c.id,
            documentId: c.documentId,
            text: c.text,
            source: c.source,
            pageNumber: c.pageNumber,
            section: c.section,
            metadata: c.metadata,
            retrievalScore: c.originalRetrievalScore,
            relevanceScore: c.crossEncoderScore,
            decision: "retained",
            rank: c.rerankedRank,
            relevanceRationale: `Cross-encoder logit: ${
              c.crossEncoderScore > 0
                ? `+${c.crossEncoderScore.toFixed(3)}`
                : c.crossEncoderScore.toFixed(3)
            } (rank #${c.rerankedRank}, moved ${
              c.rankDelta >= 0 ? `+${c.rankDelta}` : c.rankDelta
            } pos)`,
          })),
          discardedChunks: pool.candidates
            .filter((c) => !c.isSelected)
            .map((c) => ({
              id: c.id,
              documentId: c.documentId,
              text: c.text,
              source: c.source,
              pageNumber: c.pageNumber,
              section: c.section,
              metadata: c.metadata,
              retrievalScore: c.originalRetrievalScore,
              relevanceScore: c.crossEncoderScore,
              decision: "discarded",
              rank: c.rerankedRank,
              relevanceRationale: `Cross-encoder logit: ${
                c.crossEncoderScore > 0
                  ? `+${c.crossEncoderScore.toFixed(3)}`
                  : c.crossEncoderScore.toFixed(3)
              } (rank #${c.rerankedRank}, filtered outside Top-${
                pool.topNSelected
              })`,
            })),
          trace: [
            {
              id: `trace_ret_${Date.now()}`,
              timestamp: pool.retrievedAt,
              pipelineId: "advanced-rag",
              phase: "chunks_retrieved",
              label: `Retrieved ${pool.topKRetrieved} candidate passages via nomic-embed-text`,
              status: "success",
              durationMs: candidatePool.retrievalLatencyMs,
              details: {
                topK: pool.topKRetrieved,
                embeddingModel: candidatePool.embeddingModel,
              },
            },
            {
              id: `trace_eval_${Date.now()}`,
              timestamp: pool.rerankedAt,
              pipelineId: "advanced-rag",
              phase: "relevance_evaluation_completed",
              label: `Cross-encoder scored ${pool.topKRetrieved} candidates in ${pool.metrics.evaluationLatencyMs}ms`,
              status: "success",
              durationMs: pool.metrics.evaluationLatencyMs,
              details: {
                model: pool.crossEncoderModel,
                isColdStart: pool.metrics.isColdStart,
                averagePerCandidateMs: pool.metrics.averageCandidateLatencyMs,
              },
            },
            {
              id: `trace_filter_${Date.now()}`,
              timestamp: pool.rerankedAt + 1,
              pipelineId: "advanced-rag",
              phase: "chunks_filtered",
              label: `Top-${pool.topNSelected} chunks selected for context (${
                pool.topKRetrieved - pool.topNSelected
              } filtered)`,
              status: "success",
              details: {
                topN: pool.topNSelected,
                retainedCount: pool.topNSelected,
                discardedCount: pool.topKRetrieved - pool.topNSelected,
              },
            },
          ],
        },
      }));

      setRunNotice(
        `Path A Cross-Encoder reranking complete! Scored ${pool.topKRetrieved} candidates in ${pool.metrics.evaluationLatencyMs}ms. Selected Top-${pool.topNSelected} chunks for generation context.`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to rerank candidate pool.";
      setErrorMessage(message);
    } finally {
      setIsReranking(false);
    }
  };

  const handleRunLayaFilter = async () => {
    if (!candidatePool || candidatePool.candidateChunks.length === 0) return;

    setIsFilteringLaya(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/laya/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidatePool,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Laya relevance evaluation failed.");
      }

      const pool: LayaFilteredPool = data.filteredPool;
      setLayaPool(pool);

      // Update Path B in current experiment
      setCurrentExperiment((prev) => ({
        ...prev,
        layaResult: {
          pipelineId: "laya-rag",
          strategyName: "Laya Relevance Filter",
          status: "completed",
          candidateChunkCount: pool.totalCandidates,
          retainedChunkCount: pool.retainedCount,
          discardedChunkCount: pool.discardedCount,
          retrievalLatencyMs: candidatePool.retrievalLatencyMs,
          relevanceEvaluationLatencyMs: pool.metrics.evaluationLatencyMs,
          totalLatencyMs:
            candidatePool.retrievalLatencyMs + pool.metrics.evaluationLatencyMs,
          retainedChunks: pool.retainedCandidates.map((c) => ({
            id: c.id,
            documentId: c.documentId,
            text: c.text,
            source: c.source,
            pageNumber: c.pageNumber,
            section: c.section,
            metadata: c.metadata,
            retrievalScore: c.originalRetrievalScore,
            relevanceScore: c.keepProbability ?? 1.0,
            decision: "retained",
            rank: c.originalRank,
            relevanceRationale: `Laya decision: KEEP (P(keep): ${
              c.keepProbability !== undefined
                ? `${(c.keepProbability * 100).toFixed(1)}%`
                : "N/A"
            }, confidence: ${c.layaConfidence?.toFixed(4) ?? "N/A"})`,
          })),
          discardedChunks: pool.discardedCandidates.map((c) => ({
            id: c.id,
            documentId: c.documentId,
            text: c.text,
            source: c.source,
            pageNumber: c.pageNumber,
            section: c.section,
            metadata: c.metadata,
            retrievalScore: c.originalRetrievalScore,
            relevanceScore: c.keepProbability ?? 0.0,
            decision: "discarded",
            rank: c.originalRank,
            relevanceRationale: `Laya decision: DROP (P(drop): ${
              c.dropProbability !== undefined
                ? `${(c.dropProbability * 100).toFixed(1)}%`
                : "N/A"
            }, confidence: ${c.layaConfidence?.toFixed(4) ?? "N/A"})`,
          })),
          trace: [
            {
              id: `trace_laya_ret_${Date.now()}`,
              timestamp: pool.retrievedAt,
              pipelineId: "laya-rag",
              phase: "chunks_retrieved",
              label: `Retrieved ${pool.totalCandidates} candidate passages via nomic-embed-text`,
              status: "success",
              durationMs: candidatePool.retrievalLatencyMs,
              details: {
                topK: pool.totalCandidates,
                embeddingModel: candidatePool.embeddingModel,
              },
            },
            {
              id: `trace_laya_eval_${Date.now()}`,
              timestamp: pool.evaluatedAt,
              pipelineId: "laya-rag",
              phase: "relevance_evaluation_completed",
              label: `Laya evaluated ${pool.totalCandidates} candidates in ${pool.metrics.evaluationLatencyMs}ms`,
              status: "success",
              durationMs: pool.metrics.evaluationLatencyMs,
              details: {
                model: pool.layaModel,
                isColdStart: pool.metrics.isColdStart,
                averagePerCandidateMs: pool.metrics.averageCandidateLatencyMs,
              },
            },
            {
              id: `trace_laya_prune_${Date.now()}`,
              timestamp: pool.evaluatedAt + 1,
              pipelineId: "laya-rag",
              phase: "chunks_filtered",
              label: `Laya retained ${pool.retainedCount} passages, pruned ${pool.discardedCount} (${pool.contextReductionPercent}% context reduction)`,
              status: "success",
              details: {
                totalCandidates: pool.totalCandidates,
                retainedCount: pool.retainedCount,
                discardedCount: pool.discardedCount,
                contextReductionPercent: pool.contextReductionPercent,
              },
            },
          ],
        },
      }));

      setRunNotice(
        `Path B Laya relevance filtering complete! Evaluated ${pool.totalCandidates} candidates in ${pool.metrics.evaluationLatencyMs}ms. Retained ${pool.retainedCount} passages (${pool.contextReductionPercent}% context reduction).`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to evaluate candidates with Laya.";
      setErrorMessage(message);
    } finally {
      setIsFilteringLaya(false);
    }
  };

  const handleRunComparison = async (
    mode: ComparisonMode,
    topN: number,
    maxContextChunks: number
  ) => {
    if (!candidatePool || candidatePool.candidateChunks.length === 0) return;

    setIsComparing(true);
    setErrorMessage(null);
    setRunNotice(
      `Running controlled head-to-head comparison [Mode: ${mode}] against Ollama llama3.2:3b...`
    );

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: candidatePool.query,
          candidatePool,
          mode,
          topN,
          maxContextChunks,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Controlled comparison execution failed.");
      }

      const comp: ComparisonResult = data.result;
      setComparisonResult(comp);

      // Update current experiment for metrics and pipeline panels
      setCurrentExperiment({
        id: comp.id,
        query: comp.query,
        dataset: selectedDataset,
        timestamp: comp.timestamp,
        status: "completed",
        advancedRagResult: {
          pipelineId: "advanced-rag",
          strategyName: comp.crossEncoder.strategyName,
          status: comp.crossEncoder.error ? "failed" : "completed",
          answer: comp.crossEncoder.answer,
          inputTokens: comp.crossEncoder.promptTokens,
          outputTokens: comp.crossEncoder.completionTokens,
          totalTokens: comp.crossEncoder.totalTokens,
          candidateChunkCount: comp.sharedRetrieval.candidateCount,
          retainedChunkCount: comp.crossEncoder.retainedCount,
          discardedChunkCount: comp.crossEncoder.discardedCount,
          retainedChunks: comp.crossEncoder.selectedChunks,
          retrievalLatencyMs: comp.sharedRetrieval.retrievalLatencyMs,
          relevanceEvaluationLatencyMs: comp.crossEncoder.relevanceLatencyMs,
          generationLatencyMs: comp.crossEncoder.generationLatencyMs,
          totalLatencyMs: comp.crossEncoder.totalLatencyMs,
          error: comp.crossEncoder.error,
          trace: comp.trace.filter((e) => e.pipelineId === "advanced-rag"),
        },
        layaResult: {
          pipelineId: "laya-rag",
          strategyName: comp.laya.strategyName,
          status: comp.laya.error ? "failed" : "completed",
          answer: comp.laya.answer,
          inputTokens: comp.laya.promptTokens,
          outputTokens: comp.laya.completionTokens,
          totalTokens: comp.laya.totalTokens,
          candidateChunkCount: comp.sharedRetrieval.candidateCount,
          retainedChunkCount: comp.laya.retainedCount,
          discardedChunkCount: comp.laya.discardedCount,
          retainedChunks: comp.laya.selectedChunks,
          retrievalLatencyMs: comp.sharedRetrieval.retrievalLatencyMs,
          relevanceEvaluationLatencyMs: comp.laya.relevanceLatencyMs,
          generationLatencyMs: comp.laya.generationLatencyMs,
          totalLatencyMs: comp.laya.totalLatencyMs,
          error: comp.laya.error,
          trace: comp.trace.filter((e) => e.pipelineId === "laya-rag"),
        },
        comparison: {
          latencyDeltaMs:
            comp.crossEncoder.totalLatencyMs - comp.laya.totalLatencyMs,
          tokenDelta: comp.crossEncoder.totalTokens - comp.laya.totalTokens,
          retainedChunkDelta:
            comp.crossEncoder.retainedCount - comp.laya.retainedCount,
          summaryNote: `Comparison completed in ${comp.overallLatencyMs}ms. Cross-Encoder: ${comp.crossEncoder.retainedCount} chunks retained, ${comp.crossEncoder.totalLatencyMs}ms. Laya: ${comp.laya.retainedCount} chunks retained, ${comp.laya.totalLatencyMs}ms.`,
        },
      });

      setRunNotice(
        `Comparison completed in ${comp.overallLatencyMs}ms! Both paths generated answers with the same Ollama llama3.2:3b model under strict identical controls.`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to run comparison.";
      setErrorMessage(message);
    } finally {
      setIsComparing(false);
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

        {/* Compact Scientific Controls & Protocol Summary Row */}
        <div className="py-2.5 px-4 rounded-lg border border-border/80 bg-surface/70 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-muted">
            <span className="text-text-primary font-semibold">Scientific Protocol:</span>
            <span>36 Evaluation Cases</span>
            <span className="text-border-subtle">•</span>
            <span>9 Retrieval Conditions</span>
            <span className="text-border-subtle">•</span>
            <span>2 Strategies (Cross-Encoder vs Laya)</span>
            <span className="text-border-subtle">•</span>
            <span>Shared Candidate Pool</span>
            <span className="text-border-subtle">•</span>
            <span className="text-accent font-medium">Shared LLM (llama3.2:3b)</span>
          </div>

          <div className="flex items-center gap-2 text-text-muted text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>nomic-embed-text · MiniLM-L-6-v2 · ModernBERT-large</span>
          </div>
        </div>

        {/* Main View Mode Navigation Bar (3-Tier Information Architecture) */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="inline-flex rounded-lg border border-border p-1 bg-surface font-mono text-xs">
            <button
              onClick={() => setActiveTab("lab")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-colors ${
                activeTab === "lab"
                  ? "bg-accent text-white font-semibold shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40"
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Interactive RAG Lab</span>
            </button>
            <button
              onClick={() => setActiveTab("benchmark")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-colors ${
                activeTab === "benchmark"
                  ? "bg-accent text-white font-semibold shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Controlled Benchmark Suite</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-colors ${
                activeTab === "history"
                  ? "bg-accent text-white font-semibold shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40"
              }`}
            >
              <History className="h-4 w-4" />
              <span>Run History & Results</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Strict Scientific Controls</span>
          </div>
        </div>

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

            {/* 3a. Shared Candidate Chunk Pool Inspector (Phase 2 Foundation) */}
            <CandidatePoolInspector
              pool={candidatePool}
              isLoading={isRetrieving}
              onRunRerank={handleRunRerank}
              isReranking={isReranking}
              topN={rerankTopN}
              onTopNChange={setRerankTopN}
              hasReranked={!!rerankedPool}
              onRunLayaFilter={handleRunLayaFilter}
              isFilteringLaya={isFilteringLaya}
              hasLayaFiltered={!!layaPool}
            />

            {/* 3b. Cross-Encoder Reranked Pool Inspector (Phase 3 Baseline) */}
            {rerankedPool && (
              <RerankedPoolInspector
                rerankedPool={rerankedPool}
                isLoading={isReranking}
              />
            )}

            {/* 3c. Laya Filtered Pool Inspector (Phase 4 Semantic Pruning) */}
            {layaPool && (
              <LayaFilteredPoolInspector
                layaPool={layaPool}
                isLoading={isFilteringLaya}
              />
            )}

            {/* 4. Side-by-Side Comparison Workspace (Path A & Path B Active) */}
            <ComparisonWorkspace
              experiment={currentExperiment}
              candidatePool={candidatePool}
              comparisonResult={comparisonResult}
              onRunComparison={handleRunComparison}
              isComparing={isComparing}
            />

            {/* 5. Differential Metrics Dashboard */}
            <MetricsDashboard experiment={currentExperiment} />
          </>
        )}

        {/* 6. Architecture Foundation Card */}
        <section className="rounded-lg border border-border bg-surface-elevated/20 p-4 sm:p-5 text-xs">
          <div className="flex items-center gap-2 text-text-secondary font-medium mb-2">
            <Cpu className="h-4 w-4 text-accent" />
            <h3 className="text-text-primary font-semibold">
              Experimental RAG Architecture (Retrieval + Cross-Encoder + Laya + Shared LLM Generation)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-text-muted leading-relaxed">
            <div>
              <strong className="text-text-secondary block mb-0.5">
                1. Single Source of Truth Pool
              </strong>
              Vector retrieval produces a unified `CandidateChunkPool`. Both Path A (Cross-Encoder) and Path B (Laya) receive this exact pool with identical initial ranks and scores.
            </div>
            <div>
              <strong className="text-text-secondary block mb-0.5">
                2. Path A: Joint Cross-Attention
              </strong>
              Cross-encoder scores `(query, chunk)` pairs with deep transformer attention (`ms-marco-MiniLM-L-6-v2`), generating relative logit signals for Top-N selection.
            </div>
            <div>
              <strong className="text-text-secondary block mb-0.5">
                3. Path B: Laya System 1 Gating
              </strong>
              Laya evaluates passages via non-autoregressive reinforcement-learned decision rules, assigning strict KEEP/DROP decisions with calibrated probabilities.
            </div>
            <div>
              <strong className="text-text-secondary block mb-0.5">
                4. Zero Secondary Retrieval
              </strong>
              Neither strategy executes additional database searches or modifies chunk text. Context is filtered or reranked strictly post-retrieval for fair Phase 5 generation.
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
