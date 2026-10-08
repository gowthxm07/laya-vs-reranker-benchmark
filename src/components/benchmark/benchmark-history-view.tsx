"use client";

import * as React from "react";
import { BenchmarkSuiteResult } from "@/lib/types/benchmark";
import { generateBenchmarkCsv, downloadFile } from "@/lib/utils/benchmark-export";
import { History, Download, FileText, ExternalLink, RefreshCw, Layers } from "lucide-react";

interface RunSummaryItem {
  filename: string;
  runId: string;
  timestamp: number;
  gitCommit: string;
  mode: string;
  caseCount: number;
  completedCount: number;
  durationMs: number;
  llmModel: string;
  ceMeanF1: number;
  layaMeanF1: number;
  ceContextReduction: number;
  layaContextReduction: number;
  ceTotalLatency: number;
  layaTotalLatency: number;
}

interface BenchmarkHistoryViewProps {
  onLoadRunToDashboard: (result: BenchmarkSuiteResult) => void;
  onNavigateToBenchmark: () => void;
}

export function BenchmarkHistoryView({
  onLoadRunToDashboard,
  onNavigateToBenchmark,
}: BenchmarkHistoryViewProps) {
  const [runs, setRuns] = React.useState<RunSummaryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [loadingRunId, setLoadingRunId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const fetchHistory = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/benchmark/history");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load run history.");
      }
      setRuns(data.runs || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load benchmark history.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleLoadRun = async (filename: string) => {
    setLoadingRunId(filename);
    try {
      const res = await fetch(`/api/benchmark/history?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch run details.");
      }
      onLoadRunToDashboard(data.result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load run.";
      setErrorMessage(msg);
    } finally {
      setLoadingRunId(null);
    }
  };

  const handleDownloadJson = async (filename: string, runId: string) => {
    try {
      const res = await fetch(`/api/benchmark/history?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error("Failed to load run for export.");
      const jsonStr = JSON.stringify(data.result, null, 2);
      downloadFile(jsonStr, `${runId}.json`, "application/json");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Export failed.");
    }
  };

  const handleDownloadCsv = async (filename: string, runId: string) => {
    try {
      const res = await fetch(`/api/benchmark/history?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error("Failed to load run for export.");
      const csvStr = generateBenchmarkCsv(data.result);
      downloadFile(csvStr, `${runId}.csv`, "text/csv");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "CSV export failed.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="p-4 rounded-xl border border-border bg-surface-elevated/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-accent-subtle/50 text-accent">
              <History className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-text-primary">
              Benchmark Run History & Persisted Results
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-surface text-accent">
              {runs.length} Runs Recorded
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Persisted experiment logs from <code className="font-mono text-[11px] text-accent">data/benchmark/results/*.json</code>. Inspect past runs, compare across commits, or export to CSV and JSON.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-elevated text-xs font-mono text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg border border-status-error/40 bg-status-error/10 text-xs text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Runs Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted font-mono text-xs flex flex-col items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-accent" />
            <span>Loading persisted benchmark history...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-text-muted font-mono text-xs space-y-3">
            <Layers className="h-8 w-8 mx-auto text-text-muted opacity-50" />
            <p>No historical benchmark runs found in data/benchmark/results.</p>
            <button
              onClick={onNavigateToBenchmark}
              className="px-4 py-2 rounded-lg bg-accent text-white font-mono text-xs font-semibold hover:bg-accent/90 transition-colors"
            >
              Run Benchmark Suite Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                <tr>
                  <th className="p-3">Run Date / ID</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Cases</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">CE F1 vs Laya F1</th>
                  <th className="p-3">Context Reduction (CE / Laya)</th>
                  <th className="p-3">Total Latency</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[11px]">
                {runs.map((r) => {
                  const dateStr = new Date(r.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isCurrentLoading = loadingRunId === r.filename;

                  return (
                    <tr key={r.filename} className="hover:bg-surface-elevated/30 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-text-primary">{dateStr}</div>
                        <div className="text-[10px] text-text-muted truncate max-w-[160px]">
                          {r.runId}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] border ${
                            r.mode === "native"
                              ? "border-accent/40 bg-accent-subtle/20 text-accent font-medium"
                              : "border-border bg-surface-elevated text-text-secondary"
                          }`}
                        >
                          {r.mode}
                        </span>
                      </td>
                      <td className="p-3 text-text-secondary">
                        {r.completedCount} / {r.caseCount}
                      </td>
                      <td className="p-3 text-text-muted text-[10px]">
                        {r.llmModel}
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-text-primary">
                          {r.ceMeanF1.toFixed(3)}
                        </span>
                        <span className="text-text-muted mx-1">vs</span>
                        <span className="font-semibold text-accent">
                          {r.layaMeanF1.toFixed(3)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-text-secondary">
                          {r.ceContextReduction.toFixed(1)}%
                        </span>
                        <span className="text-text-muted mx-1">/</span>
                        <span className="font-semibold text-emerald-400">
                          {r.layaContextReduction.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-text-muted">
                        {r.ceTotalLatency.toFixed(0)} / {r.layaTotalLatency.toFixed(0)} ms
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleLoadRun(r.filename)}
                            disabled={isCurrentLoading}
                            title="Load run into Dashboard"
                            className="px-2.5 py-1 rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-50 text-[10px] font-semibold transition-colors flex items-center gap-1"
                          >
                            {isCurrentLoading ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3 w-3" />
                            )}
                            <span>Inspect</span>
                          </button>
                          <button
                            onClick={() => handleDownloadCsv(r.filename, r.runId)}
                            title="Download CSV"
                            className="p-1 rounded border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownloadJson(r.filename, r.runId)}
                            title="Download JSON"
                            className="p-1 rounded border border-border hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
