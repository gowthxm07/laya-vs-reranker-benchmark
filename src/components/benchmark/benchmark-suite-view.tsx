"use client";

import * as React from "react";
import {
  BenchmarkSuiteResult,
  QueryBenchmarkResult,
} from "@/lib/types/benchmark";
import { ComparisonMode } from "@/lib/types/comparison";
import { QueryDetailModal } from "./query-detail-modal";
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
} from "lucide-react";

export function BenchmarkSuiteView() {
  const [mode, setMode] = React.useState<ComparisonMode>("native");
  const [contextBudget, setContextBudget] = React.useState<number>(3);
  const [runsPerQuery, setRunsPerQuery] = React.useState<number>(1);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");

  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] =
    React.useState<BenchmarkSuiteResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Inspector modal
  const [inspectingQuery, setInspectingQuery] =
    React.useState<QueryBenchmarkResult | null>(null);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to run benchmark.";
      setErrorMessage(msg);
    } finally {
      setIsRunning(false);
    }
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
      {/* 1. Header & Dataset Overview */}
      <div className="p-4 rounded-xl border border-border bg-surface-elevated/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-accent-subtle/50 text-accent">
              <Database className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-text-primary">
              Objective Benchmark Suite (Phase 6)
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-surface text-accent">
              36 Verified Test Cases
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Systematic post-retrieval relevance and downstream LLM evaluation across 9 categories. Compares Cross-Encoder reranking against Laya filtering under identical controls.
          </p>
        </div>

        {/* Dataset Categories Pill Bar */}
        <div className="flex flex-wrap gap-1 max-w-md">
          {[
            "NORMAL",
            "DISTRACTOR_HEAVY",
            "MULTI_CHUNK",
            "AMBIGUOUS",
            "PARTIAL_CONTEXT",
            "NO_ANSWER",
            "SINGLE_RELEVANT",
            "CONFLICTING_CONTEXT",
            "LONG_CONTEXT",
          ].map((cat) => (
            <span
              key={cat}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono border border-border-subtle bg-surface/80 text-text-muted"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Controls & Configuration Bar */}
      <div className="p-4 rounded-xl border border-border bg-surface flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          {/* Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Mode:</span>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-canvas">
              <button
                onClick={() => setMode("native")}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  mode === "native"
                    ? "bg-accent text-white font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Native
              </button>
              <button
                onClick={() => setMode("context-budget")}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  mode === "context-budget"
                    ? "bg-accent text-white font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Context-Budget
              </button>
            </div>
          </div>

          {/* Budget Setting (if Context-Budget mode) */}
          {mode === "context-budget" && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Max Budget:</span>
              <input
                type="number"
                min={1}
                max={10}
                value={contextBudget}
                onChange={(e) => setContextBudget(parseInt(e.target.value, 10) || 3)}
                className="w-16 px-2 py-1 rounded border border-border bg-canvas text-text-primary text-xs font-mono"
              />
              <span className="text-text-muted text-[10px]">chunks</span>
            </div>
          )}

          {/* Runs per query */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Runs/Query:</span>
            <select
              value={runsPerQuery}
              onChange={(e) => setRunsPerQuery(parseInt(e.target.value, 10))}
              className="px-2 py-1 rounded border border-border bg-canvas text-text-primary text-xs font-mono"
            >
              <option value={1}>1 run</option>
              <option value={3}>3 runs</option>
              <option value={5}>5 runs</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2 py-1 rounded border border-border bg-canvas text-text-primary text-xs font-mono"
            >
              <option value="ALL">All (36 cases)</option>
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

        {/* Run Action Button */}
        <button
          onClick={handleRunBenchmark}
          disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-mono text-xs font-semibold shadow-sm transition-colors"
        >
          {isRunning ? (
            <>
              <Activity className="h-4 w-4 animate-spin" />
              <span>Running Benchmark...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Run Benchmark Suite</span>
            </>
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-status-error/40 bg-status-error/10 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* 3. Results Section */}
      {benchmarkResult && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg border border-border bg-surface-elevated/30 flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Relevance F1</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-bold font-mono text-accent">
                  {benchmarkResult.crossEncoderAggregates.f1.mean.toFixed(3)}
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-sm font-bold font-mono text-accent">
                  {benchmarkResult.layaAggregates.f1.mean.toFixed(3)}
                </span>
              </div>
              <span className="text-[9px] font-mono text-text-muted mt-1 text-center">
                CE / Laya
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-elevated/30 flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Context Reduction</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-bold font-mono text-text-primary">
                  {benchmarkResult.crossEncoderAggregates.contextReductionPercent.mean.toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {benchmarkResult.layaAggregates.contextReductionPercent.mean.toFixed(1)}%
                </span>
              </div>
              <span className="text-[9px] font-mono text-text-muted mt-1 text-center">
                CE / Laya
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-elevated/30 flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Relevance Latency</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {benchmarkResult.crossEncoderAggregates.relevanceLatencyMs.mean.toFixed(0)} ms
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-sm font-bold font-mono text-text-primary">
                  {benchmarkResult.layaAggregates.relevanceLatencyMs.mean.toFixed(0)} ms
                </span>
              </div>
              <span className="text-[9px] font-mono text-text-muted mt-1 text-center">
                CE / Laya
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-elevated/30 flex flex-col">
              <span className="text-[10px] font-mono text-text-muted uppercase">Total Latency</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-bold font-mono text-text-primary">
                  {benchmarkResult.crossEncoderAggregates.totalLatencyMs.mean.toFixed(0)} ms
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-sm font-bold font-mono text-text-primary">
                  {benchmarkResult.layaAggregates.totalLatencyMs.mean.toFixed(0)} ms
                </span>
              </div>
              <span className="text-[9px] font-mono text-text-muted mt-1 text-center">
                CE / Laya
              </span>
            </div>

            <div className="p-3 rounded-lg border border-border bg-surface-elevated/30 flex flex-col col-span-2 md:col-span-1">
              <span className="text-[10px] font-mono text-text-muted uppercase">Total Tokens</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm font-bold font-mono text-text-primary">
                  {benchmarkResult.crossEncoderAggregates.totalTokens.mean.toFixed(0)}
                </span>
                <span className="text-xs font-mono text-text-muted">vs</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {benchmarkResult.layaAggregates.totalTokens.mean.toFixed(0)}
                </span>
              </div>
              <span className="text-[9px] font-mono text-text-muted mt-1 text-center">
                CE / Laya
              </span>
            </div>
          </div>

          {/* Section 27: Summary Comparison Table */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="p-3.5 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Objective Aggregate Metrics Summary (No Weighted Winner)
                </h3>
              </div>
              <span className="font-mono text-[10px] text-text-muted">
                Mode: {benchmarkResult.metadata.mode} ({benchmarkResult.completedCount} cases)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                  <tr>
                    <th className="p-2.5">Metric</th>
                    <th className="p-2.5">Cross-Encoder (Path A)</th>
                    <th className="p-2.5">Laya RAG (Path B)</th>
                    <th className="p-2.5">Tradeoff Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[11px]">
                  <tr>
                    <td className="p-2.5 text-text-secondary">Relevance Precision</td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.crossEncoderAggregates.precision.mean.toFixed(4)}
                    </td>
                    <td className="p-2.5 font-semibold text-emerald-400">
                      {benchmarkResult.layaAggregates.precision.mean.toFixed(4)}
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Laya binary gating removes off-topic distractors with high selectivity
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-text-secondary">Relevance Recall</td>
                    <td className="p-2.5 font-semibold text-emerald-400">
                      {benchmarkResult.crossEncoderAggregates.recall.mean.toFixed(4)}
                    </td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.layaAggregates.recall.mean.toFixed(4)}
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Cross-Encoder retains broad candidate set minimizing false negative misses
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-text-secondary">Relevance F1 Score</td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.crossEncoderAggregates.f1.mean.toFixed(4)}
                    </td>
                    <td className="p-2.5 font-semibold text-emerald-400">
                      {benchmarkResult.layaAggregates.f1.mean.toFixed(4)}
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Harmonic mean of selection precision and recall
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-text-secondary">Hit Rate</td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {(benchmarkResult.crossEncoderAggregates.hitRate.mean * 100).toFixed(1)}%
                    </td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {(benchmarkResult.layaAggregates.hitRate.mean * 100).toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Percentage of cases where at least one ground-truth passage was retained
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-text-secondary">Avg Relevance Latency</td>
                    <td className="p-2.5 font-semibold text-emerald-400">
                      {benchmarkResult.crossEncoderAggregates.relevanceLatencyMs.mean.toFixed(1)} ms
                    </td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.layaAggregates.relevanceLatencyMs.mean.toFixed(1)} ms
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Cross-Encoder 6-layer MiniLM forward pass vs Laya ModernBERT-large 24-layer
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-text-secondary">Avg Context Reduction %</td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.crossEncoderAggregates.contextReductionPercent.mean.toFixed(1)}%
                    </td>
                    <td className="p-2.5 font-semibold text-emerald-400">
                      {benchmarkResult.layaAggregates.contextReductionPercent.mean.toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Percentage of irrelevant candidate chunks discarded prior to LLM
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-text-secondary">Avg Total Tokens</td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.crossEncoderAggregates.totalTokens.mean.toFixed(0)} tokens
                    </td>
                    <td className="p-2.5 font-semibold text-emerald-400">
                      {benchmarkResult.layaAggregates.totalTokens.mean.toFixed(0)} tokens
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Prompt and completion token footprint sent to downstream LLM
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-text-secondary">Avg Total Latency</td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.crossEncoderAggregates.totalLatencyMs.mean.toFixed(0)} ms
                    </td>
                    <td className="p-2.5 font-semibold text-text-primary">
                      {benchmarkResult.layaAggregates.totalLatencyMs.mean.toFixed(0)} ms
                    </td>
                    <td className="p-2.5 text-text-muted">
                      Complete end-to-end duration including relevance filtering & Ollama generation
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 17: Category-Level Breakdown */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="p-3.5 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Category-Level Breakdown (9 Retrieval Conditions)
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
                    <th className="p-2.5">CE Rel Latency</th>
                    <th className="p-2.5">Laya Rel Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[11px]">
                  {Object.entries(benchmarkResult.categoryAggregates).map(([cat, data]) => (
                    <tr key={cat} className="hover:bg-surface-elevated/20">
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

          {/* Section 24 & 25: Multi-Attribute Pareto Analysis & Paired Differences */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pareto Tradeoff Card */}
            <div className="p-4 rounded-xl border border-border bg-surface-elevated/20 space-y-3">
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
                <div className="p-2 rounded bg-surface border border-border">
                  <div className="text-accent font-bold">
                    {benchmarkResult.paretoAnalysis.ceDominatesLayaCount}
                  </div>
                  <div className="text-[10px] text-text-muted">CE Dominates</div>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <div className="text-accent font-bold">
                    {benchmarkResult.paretoAnalysis.layaDominatesCeCount}
                  </div>
                  <div className="text-[10px] text-text-muted">Laya Dominates</div>
                </div>
                <div className="p-2 rounded bg-surface border border-border">
                  <div className="text-emerald-400 font-bold">
                    {benchmarkResult.paretoAnalysis.tradeoffCount}
                  </div>
                  <div className="text-[10px] text-text-muted">Pareto Tradeoffs</div>
                </div>
              </div>
            </div>

            {/* Paired Differences Card */}
            <div className="p-4 rounded-xl border border-border bg-surface-elevated/20 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-accent" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Paired Difference Counts (Query by Query)
                </h3>
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                {Object.entries(benchmarkResult.pairedComparisons).slice(0, 4).map(([k, p]) => (
                  <div key={k} className="flex items-center justify-between p-1.5 rounded bg-surface/50 border border-border-subtle">
                    <span className="text-text-secondary">{p.metricName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-[10px]">
                        CE: <span className="text-text-primary">{p.ceBetterCount}</span>
                      </span>
                      <span className="text-text-muted text-[10px]">
                        Laya: <span className="text-emerald-400">{p.layaBetterCount}</span>
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

          {/* Section 28: Per-Query Inspector */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden space-y-3 p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
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
                  className="px-2.5 py-1 rounded-lg border border-border bg-canvas text-xs font-mono text-text-primary placeholder:text-text-muted w-44"
                />
                <select
                  value={failureFilter}
                  onChange={(e) => setFailureFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-border bg-canvas text-xs font-mono text-text-primary"
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
                    <th className="p-2">ID</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Query</th>
                    <th className="p-2">CE F1</th>
                    <th className="p-2">Laya F1</th>
                    <th className="p-2">Laya Red%</th>
                    <th className="p-2">Diagnosis</th>
                    <th className="p-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[11px]">
                  {filteredQueries.map((q) => (
                    <tr key={q.queryId} className="hover:bg-surface-elevated/20">
                      <td className="p-2 text-accent font-semibold">{q.queryId}</td>
                      <td className="p-2 text-text-muted text-[10px]">{q.category}</td>
                      <td className="p-2 text-text-primary max-w-xs truncate" title={q.query}>
                        {q.query}
                      </td>
                      <td className="p-2 text-text-secondary">
                        {q.crossEncoder.relevanceMetrics.f1.toFixed(3)}
                      </td>
                      <td className="p-2 text-accent font-semibold">
                        {q.laya.relevanceMetrics.f1.toFixed(3)}
                      </td>
                      <td className="p-2 text-emerald-400">
                        {q.laya.contextMetrics.contextReductionPercent.toFixed(1)}%
                      </td>
                      <td className="p-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] border ${
                            q.failureAnalysis.classification === "BOTH_CORRECT"
                              ? "border-status-success/40 bg-status-success/10 text-emerald-400"
                              : q.failureAnalysis.classification === "BOTH_INCORRECT"
                              ? "border-status-error/40 bg-status-error/10 text-rose-400"
                              : "border-status-warning/40 bg-status-warning/10 text-amber-300"
                          }`}
                        >
                          {q.failureAnalysis.classification}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => setInspectingQuery(q)}
                          className="px-2 py-1 rounded border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary text-[10px] transition-colors inline-flex items-center gap-1"
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

      {/* Detail Modal */}
      {inspectingQuery && (
        <QueryDetailModal
          result={inspectingQuery}
          onClose={() => setInspectingQuery(null)}
        />
      )}
    </div>
  );
}
