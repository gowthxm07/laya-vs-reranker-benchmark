"use client";

import * as React from "react";
import { QueryBenchmarkResult } from "@/lib/types/benchmark";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

interface QueryDetailModalProps {
  result: QueryBenchmarkResult | null;
  onClose: () => void;
}

export function QueryDetailModal({ result, onClose }: QueryDetailModalProps) {
  const [activeTab, setActiveTab] = React.useState<"overview" | "context" | "answers">("overview");

  if (!result) return null;

  const ce = result.crossEncoder;
  const laya = result.laya;
  const gt = result.groundTruth;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-elevated/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-accent text-xs font-semibold">
                {result.queryId}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-surface-elevated text-text-secondary">
                {result.category}
              </span>
              {!result.answerable && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-status-warning/40 bg-status-warning/10 text-amber-300">
                  UNANSWERABLE
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  result.failureAnalysis.classification === "BOTH_CORRECT"
                    ? "border-status-success/40 bg-status-success/10 text-emerald-400"
                    : result.failureAnalysis.classification === "BOTH_INCORRECT"
                    ? "border-status-error/40 bg-status-error/10 text-rose-400"
                    : "border-status-warning/40 bg-status-warning/10 text-amber-300"
                }`}
              >
                {result.failureAnalysis.classification}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-text-primary mt-1">
              {result.query}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 border-b border-border flex gap-4 bg-surface/50 font-mono text-[11px]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-2.5 border-b-2 font-medium transition-colors ${
              activeTab === "overview"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            Overview & Metrics
          </button>
          <button
            onClick={() => setActiveTab("answers")}
            className={`py-2.5 border-b-2 font-medium transition-colors ${
              activeTab === "answers"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            Side-by-Side Answers
          </button>
          <button
            onClick={() => setActiveTab("context")}
            className={`py-2.5 border-b-2 font-medium transition-colors ${
              activeTab === "context"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            Retained Context Passages
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Ground Truth Card */}
              <div className="p-3 rounded-lg border border-border bg-surface-elevated/30 space-y-1.5">
                <div className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-accent" />
                  <span>Ground Truth Reference</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-text-muted">Relevant Chunks: </span>
                    <span className="font-mono text-text-primary">
                      {gt.relevantChunkIds.length > 0
                        ? gt.relevantChunkIds.join(", ")
                        : "None (Intentionally unanswerable)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Required Facts: </span>
                    <span className="font-mono text-text-primary">
                      {gt.requiredFacts.length > 0
                        ? gt.requiredFacts.join(", ")
                        : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="mt-1 p-2 rounded bg-canvas/60 border border-border-subtle text-text-secondary italic">
                  &ldquo;{gt.referenceAnswer}&rdquo;
                </div>
              </div>

              {/* Head-to-Head Metric Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-left font-mono">
                  <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                    <tr>
                      <th className="p-2">Metric</th>
                      <th className="p-2">Cross-Encoder (Path A)</th>
                      <th className="p-2">Laya RAG (Path B)</th>
                      <th className="p-2">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-[11px]">
                    <tr>
                      <td className="p-2 text-text-secondary">Relevance Precision</td>
                      <td className="p-2 text-text-primary">{ce.relevanceMetrics.precision.toFixed(4)}</td>
                      <td className="p-2 text-text-primary">{laya.relevanceMetrics.precision.toFixed(4)}</td>
                      <td className="p-2 text-text-muted">{result.pairedDifferences.precisionDiff > 0 ? `+${result.pairedDifferences.precisionDiff}` : result.pairedDifferences.precisionDiff}</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-text-secondary">Relevance Recall</td>
                      <td className="p-2 text-text-primary">{ce.relevanceMetrics.recall.toFixed(4)}</td>
                      <td className="p-2 text-text-primary">{laya.relevanceMetrics.recall.toFixed(4)}</td>
                      <td className="p-2 text-text-muted">{result.pairedDifferences.recallDiff > 0 ? `+${result.pairedDifferences.recallDiff}` : result.pairedDifferences.recallDiff}</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-text-secondary">Relevance F1</td>
                      <td className="p-2 text-text-primary font-semibold">{ce.relevanceMetrics.f1.toFixed(4)}</td>
                      <td className="p-2 text-text-primary font-semibold">{laya.relevanceMetrics.f1.toFixed(4)}</td>
                      <td className="p-2 text-accent font-semibold">{result.pairedDifferences.f1Diff > 0 ? `+${result.pairedDifferences.f1Diff}` : result.pairedDifferences.f1Diff}</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-text-secondary">Retained Chunks</td>
                      <td className="p-2 text-text-primary">{ce.contextMetrics.retainedCount} of {result.initialCandidateCount}</td>
                      <td className="p-2 text-text-primary">{laya.contextMetrics.retainedCount} of {result.initialCandidateCount}</td>
                      <td className="p-2 text-text-muted">{ce.contextMetrics.retainedCount - laya.contextMetrics.retainedCount}</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-text-secondary">Context Reduction %</td>
                      <td className="p-2 text-text-primary">{ce.contextMetrics.contextReductionPercent.toFixed(1)}%</td>
                      <td className="p-2 text-text-primary">{laya.contextMetrics.contextReductionPercent.toFixed(1)}%</td>
                      <td className="p-2 text-text-muted">{result.pairedDifferences.contextReductionDiff.toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-text-secondary">Relevance Latency</td>
                      <td className="p-2 text-text-primary">{ce.latencies.relevanceMs} ms</td>
                      <td className="p-2 text-text-primary">{laya.latencies.relevanceMs} ms</td>
                      <td className="p-2 text-text-muted">{result.pairedDifferences.relevanceLatencyDiffMs} ms</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-text-secondary">Total Path Latency</td>
                      <td className="p-2 text-text-primary">{ce.latencies.totalMs} ms</td>
                      <td className="p-2 text-text-primary">{laya.latencies.totalMs} ms</td>
                      <td className="p-2 text-text-muted">{result.pairedDifferences.totalLatencyDiffMs} ms</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-text-secondary">Total Tokens (In / Out)</td>
                      <td className="p-2 text-text-primary">{ce.tokens.total} ({ce.tokens.prompt}/{ce.tokens.completion})</td>
                      <td className="p-2 text-text-primary">{laya.tokens.total} ({laya.tokens.prompt}/{laya.tokens.completion})</td>
                      <td className="p-2 text-text-muted">{result.pairedDifferences.tokenDiff} tokens</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Failure Diagnostics */}
              <div className="p-3 rounded-lg border border-border bg-surface-elevated/20 text-[11px] space-y-1">
                <div className="font-semibold text-text-secondary flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span>Failure Analysis Diagnostic</span>
                </div>
                <p className="text-text-muted">{result.failureAnalysis.notes}</p>
              </div>
            </div>
          )}

          {activeTab === "answers" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Path A Answer */}
              <div className="p-3 rounded-lg border border-border bg-surface-elevated/20 flex flex-col space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5 font-mono text-[11px]">
                  <span className="font-semibold text-accent">Cross-Encoder (Path A)</span>
                  <span className="text-text-muted">{ce.latencies.generationMs} ms</span>
                </div>
                <div className="p-3 rounded bg-canvas/70 border border-border text-text-primary whitespace-pre-wrap leading-relaxed flex-1">
                  {ce.answer || "No answer generated"}
                </div>
                <div className="text-[10px] font-mono text-text-muted flex justify-between">
                  <span>Fact Coverage: {(ce.answerMetrics.factCoverage * 100).toFixed(0)}%</span>
                  <span>Faithfulness: {(ce.answerMetrics.faithfulnessScore * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Path B Answer */}
              <div className="p-3 rounded-lg border border-border bg-surface-elevated/20 flex flex-col space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5 font-mono text-[11px]">
                  <span className="font-semibold text-accent">Laya RAG (Path B)</span>
                  <span className="text-text-muted">{laya.latencies.generationMs} ms</span>
                </div>
                <div className="p-3 rounded bg-canvas/70 border border-border text-text-primary whitespace-pre-wrap leading-relaxed flex-1">
                  {laya.answer || "No answer generated"}
                </div>
                <div className="text-[10px] font-mono text-text-muted flex justify-between">
                  <span>Fact Coverage: {(laya.answerMetrics.factCoverage * 100).toFixed(0)}%</span>
                  <span>Faithfulness: {(laya.answerMetrics.faithfulnessScore * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "context" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Path A Context */}
              <div className="space-y-2">
                <div className="font-mono text-[11px] font-semibold text-accent">
                  Cross-Encoder Retained ({ce.selectedChunkIds.length} chunks)
                </div>
                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                  {ce.selectedChunkIds.length === 0 ? (
                    <div className="p-3 rounded border border-border text-text-muted italic">
                      Zero chunks retained (Empty Context).
                    </div>
                  ) : (
                    ce.selectedChunkIds.map((cid, i) => (
                      <div
                        key={cid}
                        className={`p-2.5 rounded border text-[11px] space-y-1 ${
                          gt.relevantChunkIds.includes(cid)
                            ? "border-emerald-500/40 bg-emerald-950/10"
                            : "border-border bg-surface-elevated/40"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="text-text-primary font-semibold">#{i + 1} {cid}</span>
                          {gt.relevantChunkIds.includes(cid) && (
                            <span className="text-emerald-400 font-semibold">RELEVANT</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Path B Context */}
              <div className="space-y-2">
                <div className="font-mono text-[11px] font-semibold text-accent">
                  Laya RAG Retained ({laya.selectedChunkIds.length} chunks)
                </div>
                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                  {laya.selectedChunkIds.length === 0 ? (
                    <div className="p-3 rounded border border-border text-text-muted italic">
                      Zero chunks retained (All Dropped / Empty Context).
                    </div>
                  ) : (
                    laya.selectedChunkIds.map((cid, i) => (
                      <div
                        key={cid}
                        className={`p-2.5 rounded border text-[11px] space-y-1 ${
                          gt.relevantChunkIds.includes(cid)
                            ? "border-emerald-500/40 bg-emerald-950/10"
                            : "border-border bg-surface-elevated/40"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="text-text-primary font-semibold">#{i + 1} {cid}</span>
                          {gt.relevantChunkIds.includes(cid) && (
                            <span className="text-emerald-400 font-semibold">RELEVANT</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border flex justify-end bg-surface-elevated/40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-border hover:bg-surface-elevated font-mono text-xs text-text-primary transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
