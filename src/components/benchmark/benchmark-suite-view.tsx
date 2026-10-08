"use client";

import * as React from "react";
import {
  BenchmarkSuiteResult,
  QueryBenchmarkResult,
} from "@/lib/types/benchmark";
import { ComparisonMode } from "@/lib/types/comparison";
import { QueryDetailModal } from "./query-detail-modal";
import { generateBenchmarkCsv, downloadFile } from "@/lib/utils/benchmark-export";
import {
  Play,
  Sliders,
  Database,
  BarChart2,
  Cpu,
  Layers,
  Search,
  Eye,
  Activity,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Zap,
  Target,
} from "lucide-react";

interface BenchmarkSuiteViewProps {
  initialResult?: BenchmarkSuiteResult | null;
  onResultChange?: (result: BenchmarkSuiteResult | null) => void;
}

export function BenchmarkSuiteView({
  initialResult = null,
  onResultChange,
}: BenchmarkSuiteViewProps) {
  const [mode, setMode] = React.useState<ComparisonMode>("native");
  const [contextBudget, setContextBudget] = React.useState<number>(3);
  const [runsPerQuery, setRunsPerQuery] = React.useState<number>(1);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");

  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] =
    React.useState<BenchmarkSuiteResult | null>(initialResult);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Synchronize if initialResult prop changes externally (e.g. from history loader)
  React.useEffect(() => {
    if (initialResult) {
      setBenchmarkResult(initialResult);
      if (initialResult.metadata?.mode) {
        setMode(initialResult.metadata.mode);
      }
      if (initialResult.metadata?.contextBudget) {
        setContextBudget(initialResult.metadata.contextBudget);
      }
    }
  }, [initialResult]);

  // Inspector modal
  const [inspectingQuery, setInspectingQuery] =
    React.useState<QueryBenchmarkResult | null>(null);

  // Active metrics grouping tab in summary
  const [metricGroupTab, setMetricGroupTab] = React.useState<
    "relevance" | "efficiency" | "quality"
  >("relevance");

  // Filter queries in table
  const [queryFilter, setQueryFilter] = React.useState<string>("");
  const [failureFilter, setFailureFilter] = React.useState<string>("ALL");

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          contextBudget,
          runsPerQuery,
          category: selectedCategory === "ALL" ? undefined : selectedCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Benchmark execution failed.");
      }

      setBenchmarkResult(data.result);
      if (onResultChange) {
        onResultChange(data.result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to run benchmark.";
      setErrorMessage(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportCsv = () => {
    if (!benchmarkResult) return;
    const csvContent = generateBenchmarkCsv(benchmarkResult);
    const filename = `patternrag-benchmark-${benchmarkResult.runId}.csv`;
    downloadFile(csvContent, filename, "text/csv");
  };

  const handleExportJson = () => {
    if (!benchmarkResult) return;
    const jsonContent = JSON.stringify(benchmarkResult, null, 2);
    const filename = `patternrag-benchmark-${benchmarkResult.runId}.json`;
    downloadFile(jsonContent, filename, "application/json");
  };

  // Filtered query results
  const filteredQueries = React.useMemo(() => {
    if (!benchmarkResult) return [];
    return benchmarkResult.queryResults.filter((q) => {
      const matchesSearch =
        !queryFilter ||
        q.query.toLowerCase().includes(queryFilter.toLowerCase()) ||
        q.queryId.toLowerCase().includes(queryFilter.toLowerCase());

      const matchesCategory =
        selectedCategory === "ALL" || q.category === selectedCategory;

      const matchesFailure =
        failureFilter === "ALL" ||
        q.failureAnalysis.classification === failureFilter;

      return matchesSearch && matchesCategory && matchesFailure;
    });
  }, [benchmarkResult, queryFilter, selectedCategory, failureFilter]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls Card */}
      <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-accent-subtle/50 text-accent">
                <Database className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-text-primary">
                Controlled Benchmark Suite
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-surface-elevated text-accent">
                36 Verified Test Cases · 9 Categories
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Deterministic post-retrieval relevance and generation evaluation comparing Cross-Encoder reranking (Path A) against Laya binary gating (Path B) under identical shared controls.
            </p>
          </div>

          {/* Action & Export Buttons */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            {benchmarkResult && (
              <>
                <button
                  onClick={handleExportCsv}
                  title="Export results to CSV"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={handleExportJson}
                  title="Export full JSON"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-accent" />
                  <span>JSON</span>
                </button>
              </>
            )}

            <button
              onClick={handleRunBenchmark}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-mono text-xs font-semibold shadow-sm transition-colors"
            >
              {isRunning ? (
                <>
                  <Activity className="h-4 w-4 animate-spin" />
                  <span>Running Benchmark...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Run Suite</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Mode Separation & Execution Parameters */}
        <div className="pt-3 border-t border-border/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode Switcher with Visual Contrast */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-text-muted">
              Relevance Comparison Mode:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("native")}
                className={`p-2.5 rounded-lg border text-left font-mono transition-all ${
                  mode === "native"
                    ? "border-accent bg-accent-subtle/20 text-text-primary ring-1 ring-accent"
                    : "border-border bg-canvas text-text-secondary hover:bg-surface-elevated/40"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Native Mode</span>
                  {mode === "native" && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </div>
                <p className="text-[10px] text-text-muted font-sans mt-0.5 leading-snug">
                  CE Top-5 ranking vs Laya threshold binary gating. Evaluates natural behavior.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("context-budget")}
                className={`p-2.5 rounded-lg border text-left font-mono transition-all ${
                  mode === "context-budget"
                    ? "border-accent bg-accent-subtle/20 text-text-primary ring-1 ring-accent"
                    : "border-border bg-canvas text-text-secondary hover:bg-surface-elevated/40"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Budget Mode</span>
                  {mode === "context-budget" && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </div>
                <p className="text-[10px] text-text-muted font-sans mt-0.5 leading-snug">
                  Both capped to identical max chunks ({contextBudget}). Isolates pure relevance quality.
                </p>
              </button>
            </div>
          </div>

          {/* Configuration Controls */}
          <div className="flex flex-wrap items-end gap-3 font-mono text-xs">
            {mode === "context-budget" && (
              <div className="space-y-1">
                <label className="text-[11px] text-text-muted">Max Budget:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={contextBudget}
                    onChange={(e) => setContextBudget(parseInt(e.target.value, 10) || 3)}
                    className="w-16 px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-text-primary text-xs"
                  />
                  <span className="text-[10px] text-text-muted">chunks</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] text-text-muted">Runs/Query:</label>
              <select
                value={runsPerQuery}
                onChange={(e) => setRunsPerQuery(parseInt(e.target.value, 10))}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-text-primary text-xs"
              >
                <option value={1}>1 run (Fast)</option>
                <option value={3}>3 runs (Median)</option>
              </select>
            </div>

            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-[11px] text-text-muted">Category Scope:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-text-primary text-xs"
              >
                <option value="ALL">All Categories (36 cases)</option>
                <option value="NORMAL">NORMAL</option>
                <option value="DISTRACTOR_HEAVY">DISTRACTOR_HEAVY</option>
                <option value="MULTI_CHUNK">MULTI_CHUNK</option>
                <option value="AMBIGUOUS">AMBIGUOUS</option>
                <option value="PARTIAL_CONTEXT">PARTIAL_CONTEXT</option>
                <option value="NO_ANSWER">NO_ANSWER</option>
                <option value="SINGLE_RELEVANT">SINGLE_RELEVANT</option>
                <option value="CONFLICTING_CONTEXT">CONFLICTING_CONTEXT</option>
                <option value="LONG_CONTEXT">LONG_CONTEXT</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl border border-status-error/40 bg-status-error/10 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* 3. Results Section */}
      {benchmarkResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-surface flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Relevance F1</span>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-base font-bold font-mono text-text-primary">
                  {benchmarkResult.crossEncoderAggregates.f1.mean.toFixed(3)}
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-base font-bold font-mono text-accent">
                  {benchmarkResult.layaAggregates.f1.mean.toFixed(3)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted mt-1">
                Cross-Encoder / Laya
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-surface flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Context Reduction</span>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-base font-bold font-mono text-text-primary">
                  {benchmarkResult.crossEncoderAggregates.contextReductionPercent.mean.toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {benchmarkResult.layaAggregates.contextReductionPercent.mean.toFixed(1)}%
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted mt-1">
                Cross-Encoder / Laya
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-surface flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Fact Coverage</span>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-base font-bold font-mono text-text-primary">
                  {(benchmarkResult.crossEncoderAggregates.factCoverage.mean * 100).toFixed(0)}%
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-base font-bold font-mono text-text-primary">
                  {(benchmarkResult.layaAggregates.factCoverage.mean * 100).toFixed(0)}%
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted mt-1">
                Cross-Encoder / Laya
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-surface flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Relevance Latency</span>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-base font-bold font-mono text-emerald-400">
                  {benchmarkResult.crossEncoderAggregates.relevanceLatencyMs.mean.toFixed(0)} ms
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-base font-bold font-mono text-text-primary">
                  {benchmarkResult.layaAggregates.relevanceLatencyMs.mean.toFixed(0)} ms
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted mt-1">
                Cross-Encoder / Laya
              </span>
            </div>
          </div>

          {/* 3 Conceptual Metric Groups Tabbed Container */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="p-3.5 border-b border-border bg-surface-elevated/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Objective Aggregate Evaluation
                </h3>
              </div>

              {/* Sub-tabs for 3 Metric Groups */}
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-canvas font-mono text-xs">
                <button
                  onClick={() => setMetricGroupTab("relevance")}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    metricGroupTab === "relevance"
                      ? "bg-accent text-white font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Target className="h-3.5 w-3.5" />
                  <span>1. Relevance Quality</span>
                </button>
                <button
                  onClick={() => setMetricGroupTab("efficiency")}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    metricGroupTab === "efficiency"
                      ? "bg-accent text-white font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>2. Efficiency</span>
                </button>
                <button
                  onClick={() => setMetricGroupTab("quality")}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    metricGroupTab === "quality"
                      ? "bg-accent text-white font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>3. Answer Quality</span>
                </button>
              </div>
            </div>

            {/* Metric Tables according to Group */}
            <div className="overflow-x-auto">
              {metricGroupTab === "relevance" && (
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                    <tr>
                      <th className="p-3">Relevance Metric</th>
                      <th className="p-3">Cross-Encoder (Path A)</th>
                      <th className="p-3">Laya RAG (Path B)</th>
                      <th className="p-3">Analytical Tradeoff & Scientific Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-[11px]">
                    <tr>
                      <td className="p-3 text-text-secondary">Precision</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.crossEncoderAggregates.precision.mean.toFixed(4)}
                      </td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {benchmarkResult.layaAggregates.precision.mean.toFixed(4)}
                      </td>
                      <td className="p-3 text-text-muted">
                        Fraction of selected chunks that are ground-truth relevant. Laya binary gating eliminates off-topic distractors with high selectivity.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">Recall</td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {benchmarkResult.crossEncoderAggregates.recall.mean.toFixed(4)}
                      </td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.layaAggregates.recall.mean.toFixed(4)}
                      </td>
                      <td className="p-3 text-text-muted">
                        Fraction of ground-truth relevant chunks retained. Cross-Encoder Top-N retains broad sets, avoiding false negatives at the cost of distractors.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">F1 Score</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.crossEncoderAggregates.f1.mean.toFixed(4)}
                      </td>
                      <td className="p-3 font-semibold text-accent">
                        {benchmarkResult.layaAggregates.f1.mean.toFixed(4)}
                      </td>
                      <td className="p-3 text-text-muted">
                        Harmonic mean balancing selection precision against recall.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">Hit Rate</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.crossEncoderAggregates.hitRate.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.layaAggregates.hitRate.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-text-muted">
                        Proportion of cases retaining at least one ground-truth passage.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">MRR / NDCG@K</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.crossEncoderAggregates.mrr
                          ? `MRR: ${benchmarkResult.crossEncoderAggregates.mrr.mean.toFixed(3)} | NDCG: ${benchmarkResult.crossEncoderAggregates.ndcg?.mean.toFixed(3)}`
                          : "Calculated per ranking case"}
                      </td>
                      <td className="p-3 text-text-muted italic">
                        N/A (Unordered Binary Gating)
                      </td>
                      <td className="p-3 text-text-muted">
                        Ranking metrics (MRR/NDCG) apply exclusively to ordered permutation lists (CE logits). Laya produces unordered binary sets (KEEP/DROP).
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {metricGroupTab === "efficiency" && (
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                    <tr>
                      <th className="p-3">Efficiency Metric</th>
                      <th className="p-3">Cross-Encoder (Path A)</th>
                      <th className="p-3">Laya RAG (Path B)</th>
                      <th className="p-3">Analytical Tradeoff & Scientific Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-[11px]">
                    <tr>
                      <td className="p-3 text-text-secondary">Context Reduction %</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.crossEncoderAggregates.contextReductionPercent.mean.toFixed(1)}%
                      </td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {benchmarkResult.layaAggregates.contextReductionPercent.mean.toFixed(1)}%
                      </td>
                      <td className="p-3 text-text-muted">
                        Percentage of candidate chunks pruned prior to downstream LLM prompt injection.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">Total Tokens (In + Out)</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.crossEncoderAggregates.totalTokens.mean.toFixed(0)} tokens
                      </td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {benchmarkResult.layaAggregates.totalTokens.mean.toFixed(0)} tokens
                      </td>
                      <td className="p-3 text-text-muted">
                        Prompt and completion token footprint sent to downstream Ollama llama3.2:3b.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">Relevance Latency</td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {benchmarkResult.crossEncoderAggregates.relevanceLatencyMs.mean.toFixed(1)} ms
                      </td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.layaAggregates.relevanceLatencyMs.mean.toFixed(1)} ms
                      </td>
                      <td className="p-3 text-text-muted">
                        MiniLM-L-6-v2 (6-layer) forward pass vs ModernBERT-large (24-layer) evaluation.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">Total Latency (End-to-End)</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.crossEncoderAggregates.totalLatencyMs.mean.toFixed(0)} ms
                      </td>
                      <td className="p-3 font-semibold text-text-primary">
                        {benchmarkResult.layaAggregates.totalLatencyMs.mean.toFixed(0)} ms
                      </td>
                      <td className="p-3 text-text-muted">
                        Combined relevance evaluation and downstream Ollama LLM generation time.
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {metricGroupTab === "quality" && (
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                    <tr>
                      <th className="p-3">Answer Quality Metric</th>
                      <th className="p-3">Cross-Encoder (Path A)</th>
                      <th className="p-3">Laya RAG (Path B)</th>
                      <th className="p-3">Analytical Tradeoff & Scientific Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-[11px]">
                    <tr>
                      <td className="p-3 text-text-secondary">Fact Coverage %</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.crossEncoderAggregates.factCoverage.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.layaAggregates.factCoverage.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-text-muted">
                        Deterministic matching of domain factual tokens required by ground truth in the generated answer.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">Lexical Groundedness %</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.crossEncoderAggregates.faithfulnessScore.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.layaAggregates.faithfulnessScore.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-text-muted">
                        Deterministic token overlap of non-stopwords in the answer with the retained context passages.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 text-text-secondary">Reference Similarity</td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.crossEncoderAggregates.referenceAnswerSimilarity.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-semibold text-text-primary">
                        {(benchmarkResult.layaAggregates.referenceAnswerSimilarity.mean * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-text-muted">
                        Jaccard and Dice coefficient overlap against verified gold reference answers.
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Pareto & Paired Differences Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pareto Analysis */}
            <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Multi-Dimensional Pareto Tradeoffs
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {benchmarkResult.paretoAnalysis.summary}
              </p>
              <div className="grid grid-cols-3 gap-2 font-mono text-center text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-surface-elevated/40 border border-border">
                  <div className="text-accent font-bold">
                    {benchmarkResult.paretoAnalysis.ceDominatesLayaCount}
                  </div>
                  <div className="text-[10px] text-text-muted">CE Dominates</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-elevated/40 border border-border">
                  <div className="text-accent font-bold">
                    {benchmarkResult.paretoAnalysis.layaDominatesCeCount}
                  </div>
                  <div className="text-[10px] text-text-muted">Laya Dominates</div>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-elevated/40 border border-border">
                  <div className="text-emerald-400 font-bold">
                    {benchmarkResult.paretoAnalysis.tradeoffCount}
                  </div>
                  <div className="text-[10px] text-text-muted">Pareto Tradeoffs</div>
                </div>
              </div>
            </div>

            {/* Paired Differences */}
            <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Paired Difference Counts (Query by Query)
                </h3>
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                {Object.entries(benchmarkResult.pairedComparisons).slice(0, 4).map(([k, p]) => (
                  <div key={k} className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated/30 border border-border">
                    <span className="text-text-secondary">{p.metricName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-[10px]">
                        CE: <span className="text-text-primary font-semibold">{p.ceBetterCount}</span>
                      </span>
                      <span className="text-text-muted text-[10px]">
                        Laya: <span className="text-emerald-400 font-semibold">{p.layaBetterCount}</span>
                      </span>
                      <span className="text-text-muted text-[10px]">
                        Ties: <span className="text-text-primary">{p.tieCount}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="p-3.5 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Category Breakdown Across 9 Benchmark Categories
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Cases</th>
                    <th className="p-2.5">CE F1</th>
                    <th className="p-2.5">Laya F1</th>
                    <th className="p-2.5">CE Red %</th>
                    <th className="p-2.5">Laya Red %</th>
                    <th className="p-2.5">CE Latency</th>
                    <th className="p-2.5">Laya Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[11px]">
                  {Object.entries(benchmarkResult.categoryAggregates).map(([cat, data]) => (
                    <tr key={cat} className="hover:bg-surface-elevated/30 transition-colors">
                      <td className="p-2.5 font-semibold text-text-primary">{cat}</td>
                      <td className="p-2.5 text-text-muted">{data.caseCount}</td>
                      <td className="p-2.5 text-text-secondary">{data.crossEncoder.meanF1.toFixed(3)}</td>
                      <td className="p-2.5 font-semibold text-accent">{data.laya.meanF1.toFixed(3)}</td>
                      <td className="p-2.5 text-text-muted">{data.crossEncoder.meanContextReduction.toFixed(1)}%</td>
                      <td className="p-2.5 font-semibold text-emerald-400">{data.laya.meanContextReduction.toFixed(1)}%</td>
                      <td className="p-2.5 text-emerald-400">{data.crossEncoder.meanRelevanceLatencyMs.toFixed(0)} ms</td>
                      <td className="p-2.5 text-text-muted">{data.laya.meanRelevanceLatencyMs.toFixed(0)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-Query Benchmark Inspector Table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden space-y-3 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Per-Query Benchmark Inspector ({filteredQueries.length} of {benchmarkResult.queryResults.length})
                </h3>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter queries..."
                  value={queryFilter}
                  onChange={(e) => setQueryFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-xs font-mono text-text-primary placeholder:text-text-muted w-44"
                />
                <select
                  value={failureFilter}
                  onChange={(e) => setFailureFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-canvas text-xs font-mono text-text-primary"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="BOTH_CORRECT">BOTH_CORRECT</option>
                  <option value="BOTH_INCORRECT">BOTH_INCORRECT</option>
                  <option value="PARTIAL_AGREEMENT">PARTIAL_AGREEMENT</option>
                  <option value="CROSS_ENCODER_FALSE_POSITIVE">CE False Positive</option>
                  <option value="LAYA_FALSE_POSITIVE">Laya False Positive</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Query</th>
                    <th className="p-2.5">CE F1</th>
                    <th className="p-2.5">Laya F1</th>
                    <th className="p-2.5">Reduction (CE / Laya)</th>
                    <th className="p-2.5">Outcome</th>
                    <th className="p-2.5 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[11px]">
                  {filteredQueries.map((q) => (
                    <tr
                      key={q.queryId}
                      className="hover:bg-surface-elevated/40 cursor-pointer transition-colors"
                      onClick={() => setInspectingQuery(q)}
                    >
                      <td className="p-2.5 font-semibold text-accent">{q.queryId}</td>
                      <td className="p-2.5 text-text-muted text-[10px]">{q.category}</td>
                      <td className="p-2.5 max-w-[280px] truncate text-text-primary" title={q.query}>
                        {q.query}
                      </td>
                      <td className="p-2.5 text-text-secondary">{q.crossEncoder.relevanceMetrics.f1.toFixed(3)}</td>
                      <td className="p-2.5 font-semibold text-accent">{q.laya.relevanceMetrics.f1.toFixed(3)}</td>
                      <td className="p-2.5 text-text-muted">
                        {q.crossEncoder.contextMetrics.contextReductionPercent.toFixed(0)}% / {q.laya.contextMetrics.contextReductionPercent.toFixed(0)}%
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] border ${
                            q.failureAnalysis.classification === "BOTH_CORRECT"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                              : q.failureAnalysis.classification === "BOTH_INCORRECT"
                              ? "border-rose-500/40 text-rose-300 bg-rose-950/20"
                              : "border-amber-500/40 text-amber-300 bg-amber-950/20"
                          }`}
                        >
                          {q.failureAnalysis.classification}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingQuery(q);
                          }}
                          className="px-2 py-1 rounded border border-border hover:bg-surface-elevated text-[10px] text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Query Detail Modal with Chunk Decisions Inspector */}
      {inspectingQuery && (
        <QueryDetailModal
          result={inspectingQuery}
          onClose={() => setInspectingQuery(null)}
        />
      )}
    </div>
  );
}
