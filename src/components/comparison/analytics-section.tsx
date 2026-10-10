"use client";

import * as React from "react";
import { ComparisonResult } from "@/lib/types/comparison";
import { formatLatency, formatTokens } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";

interface AnalyticsSectionProps {
  comparisonResult?: ComparisonResult | null;
  onOpenContextViewer: (strategy: "a" | "b") => void;
}

export function AnalyticsSection({
  comparisonResult,
  onOpenContextViewer,
}: AnalyticsSectionProps) {
  // Compute ground truth metrics if annotations exist in candidate pool
  const { groundTruthCount, ceMetrics, layaMetrics } = React.useMemo(() => {
    if (!comparisonResult) {
      return {
        groundTruthCount: 0,
        ceMetrics: { precision: null, recall: null, f1: null },
        layaMetrics: { precision: null, recall: null, f1: null },
      };
    }

    const pool = comparisonResult.sharedRetrieval.candidatePool;
    const gtRelevantIds = pool.candidateChunks
      .filter(
        (c) =>
          c.metadata?.isRelevant === true ||
          c.metadata?.groundTruthRelevance === true
      )
      .map((c) => c.id);

    if (gtRelevantIds.length === 0) {
      return {
        groundTruthCount: 0,
        ceMetrics: { precision: null, recall: null, f1: null },
        layaMetrics: { precision: null, recall: null, f1: null },
      };
    }

    const gtSet = new Set(gtRelevantIds);

    // Cross-Encoder
    const ceSelected = new Set(comparisonResult.crossEncoder.selectedChunkIds);
    const ceHits = gtRelevantIds.filter((id) => ceSelected.has(id)).length;
    const ceP = ceSelected.size > 0 ? (ceHits / ceSelected.size) * 100 : 0;
    const ceR = gtSet.size > 0 ? (ceHits / gtSet.size) * 100 : 0;
    const ceF = ceP + ceR > 0 ? (2 * ceP * ceR) / (ceP + ceR) : 0;

    // Laya
    const layaSelected = new Set(comparisonResult.laya.selectedChunkIds);
    const layaHits = gtRelevantIds.filter((id) => layaSelected.has(id)).length;
    const layaP = layaSelected.size > 0 ? (layaHits / layaSelected.size) * 100 : 0;
    const layaR = gtSet.size > 0 ? (layaHits / gtSet.size) * 100 : 0;
    const layaF = layaP + layaR > 0 ? (2 * layaP * layaR) / (layaP + layaR) : 0;

    return {
      groundTruthCount: gtSet.size,
      ceMetrics: { precision: ceP, recall: ceR, f1: ceF },
      layaMetrics: { precision: layaP, recall: layaR, f1: layaF },
    };
  }, [comparisonResult]);

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div>
        <h2 className="text-xs font-mono font-semibold tracking-wider text-accent uppercase">
          04 — ANALYTICS
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Results for the current query.
        </p>
      </div>

      {!comparisonResult ? (
        /* Empty State */
        <div className="border border-dashed border-border rounded-lg p-8 bg-white text-center">
          <p className="text-sm text-text-muted">
            Results will appear here after the current query is evaluated.
          </p>
        </div>
      ) : (
        /* Populated Results View */
        <div className="space-y-6">
          {/* Strict Filtering Diagnostic Indicator */}
          {comparisonResult.laya.filteringThreshold !== undefined && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs font-mono text-sky-950 flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                <span className="font-semibold">
                  Laya strict filtering: &tau; = {comparisonResult.laya.filteringThreshold.toFixed(2)} | Candidates: {comparisonResult.sharedRetrieval.candidateCount} | Retained: {comparisonResult.laya.retainedCount} | Dropped: {comparisonResult.laya.discardedCount}
                </span>
              </div>
              <span className="text-[11px] text-sky-700 font-sans">
                {comparisonResult.laya.promptTokens < comparisonResult.crossEncoder.promptTokens
                  ? `${Math.round(((comparisonResult.crossEncoder.promptTokens - comparisonResult.laya.promptTokens) / comparisonResult.crossEncoder.promptTokens) * 100)}% prompt token reduction vs Cross-Encoder`
                  : `${comparisonResult.laya.discardedCount} passages filtered before synthesis`}
              </span>
            </div>
          )}

          {/* Primary Metrics Comparison Table */}
          <div className="border border-border rounded-lg bg-white overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/40 text-text-muted font-medium">
                  <th className="py-3 px-4 font-normal">Metric</th>
                  <th className="py-3 px-4 font-medium text-text-primary text-right sm:text-left">
                    Cross-Encoder
                  </th>
                  <th className="py-3 px-4 font-medium text-text-primary text-right sm:text-left">
                    Laya
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* Precision */}
                <tr className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary">Precision</td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {ceMetrics.precision !== null ? `${ceMetrics.precision.toFixed(1)}%` : "N/A — unannotated"}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {layaMetrics.precision !== null ? `${layaMetrics.precision.toFixed(1)}%` : "N/A — unannotated"}
                  </td>
                </tr>

                {/* Recall */}
                <tr className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary">Recall</td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {ceMetrics.recall !== null ? `${ceMetrics.recall.toFixed(1)}%` : "N/A — unannotated"}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {layaMetrics.recall !== null ? `${layaMetrics.recall.toFixed(1)}%` : "N/A — unannotated"}
                  </td>
                </tr>

                {/* F1 */}
                <tr className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary">F1</td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {ceMetrics.f1 !== null ? `${ceMetrics.f1.toFixed(1)}%` : "N/A — unannotated"}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {layaMetrics.f1 !== null ? `${layaMetrics.f1.toFixed(1)}%` : "N/A — unannotated"}
                  </td>
                </tr>

                {/* Retained Chunks */}
                <tr className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary">Retained Chunks</td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.crossEncoder.error
                      ? "N/A — failed"
                      : `${comparisonResult.crossEncoder.retainedCount} / ${comparisonResult.sharedRetrieval.candidateCount}`}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.laya.error
                      ? "N/A — failed"
                      : (
                        <span>
                          {comparisonResult.laya.retainedCount} / {comparisonResult.sharedRetrieval.candidateCount}
                          {comparisonResult.laya.filteringThreshold !== undefined && (
                            <span className="text-text-muted font-mono text-[10px] ml-1">
                              (&tau; = {comparisonResult.laya.filteringThreshold.toFixed(2)})
                            </span>
                          )}
                        </span>
                      )}
                  </td>
                </tr>

                {/* Context Reduction */}
                <tr className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary">Context Reduction</td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.crossEncoder.error
                      ? "N/A — failed"
                      : comparisonResult.sharedRetrieval.candidateCount > 0
                      ? `${(
                          ((comparisonResult.sharedRetrieval.candidateCount -
                            comparisonResult.crossEncoder.retainedCount) /
                            comparisonResult.sharedRetrieval.candidateCount) *
                          100
                        ).toFixed(1)}%`
                      : "0.0%"}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.laya.error
                      ? "N/A — failed"
                      : comparisonResult.sharedRetrieval.candidateCount > 0
                      ? `${(
                          ((comparisonResult.sharedRetrieval.candidateCount -
                            comparisonResult.laya.retainedCount) /
                            comparisonResult.sharedRetrieval.candidateCount) *
                          100
                        ).toFixed(1)}%`
                      : "0.0%"}
                  </td>
                </tr>

                {/* Prompt Tokens */}
                <tr className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary">Prompt Tokens</td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.crossEncoder.error
                      ? "N/A — failed"
                      : formatTokens(comparisonResult.crossEncoder.promptTokens)}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.laya.error
                      ? "N/A — failed"
                      : formatTokens(comparisonResult.laya.promptTokens)}
                  </td>
                </tr>

                {/* Total Latency */}
                <tr className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="py-2.5 px-4 text-text-secondary">Total Latency</td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.crossEncoder.error
                      ? "N/A — failed"
                      : formatLatency(comparisonResult.crossEncoder.totalLatencyMs)}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary text-right sm:text-left">
                    {comparisonResult.laya.error
                      ? "N/A — failed"
                      : formatLatency(comparisonResult.laya.totalLatencyMs)}
                  </td>
                </tr>
              </tbody>
            </table>

            {groundTruthCount === 0 && (
              <div className="px-4 py-2 border-t border-border/60 bg-surface-subtle/40 text-[11px] text-text-muted">
                Note: Relevance metrics require annotated ground-truth passages. Custom interactive queries are unannotated.
              </div>
            )}
          </div>

          {/* Generated Answers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Generated Answers
              </h3>
              <span className="text-[11px] font-mono text-text-muted">
                Same model: {comparisonResult.llmModel || "llama3.2:3b"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cross-Encoder Answer */}
              <div className="border border-border rounded-lg p-4 bg-white space-y-2">
                <div className="text-xs font-semibold text-text-primary">
                  Cross-Encoder
                </div>
                {comparisonResult.crossEncoder.error ? (
                  <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded border border-rose-200 leading-relaxed font-mono">
                    <strong>Evaluation failed:</strong> {comparisonResult.crossEncoder.error}
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {comparisonResult.crossEncoder.answer || "No response generated."}
                  </div>
                )}
              </div>

              {/* Laya Answer */}
              <div className="border border-border rounded-lg p-4 bg-white space-y-2">
                <div className="text-xs font-semibold text-text-primary">
                  Laya
                </div>
                {comparisonResult.laya.error ? (
                  <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded border border-rose-200 leading-relaxed font-mono">
                    <strong>Evaluation failed / timed out:</strong> {comparisonResult.laya.error}
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {comparisonResult.laya.answer || "No response generated."}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Detailed Analysis */}
          <details className="text-xs text-text-muted pt-2 border-t border-border">
            <summary className="cursor-pointer hover:text-text-primary font-medium select-none text-xs text-text-secondary py-1">
              Detailed Analysis
            </summary>
            <div className="mt-4 space-y-5">
              {/* Latency Decomposition */}
              <div className="space-y-2">
                <h4 className="font-semibold text-text-primary text-xs">
                  Latency Decomposition
                </h4>
                <div className="border border-border rounded-lg bg-white overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/30 text-text-muted">
                        <th className="py-2 px-3 text-left font-normal">Stage</th>
                        <th className="py-2 px-3 text-left font-normal">Cross-Encoder</th>
                        <th className="py-2 px-3 text-left font-normal">Laya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                      <tr>
                        <td className="py-2 px-3 text-text-secondary font-sans">Relevance Evaluation</td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.crossEncoder.error ? "N/A" : formatLatency(comparisonResult.crossEncoder.relevanceLatencyMs)}
                        </td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.laya.error ? "N/A" : formatLatency(comparisonResult.laya.relevanceLatencyMs)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-text-secondary font-sans">Context Assembly</td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.crossEncoder.error ? "N/A" : formatLatency(comparisonResult.crossEncoder.contextBuildLatencyMs)}
                        </td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.laya.error ? "N/A" : formatLatency(comparisonResult.laya.contextBuildLatencyMs)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-text-secondary font-sans">LLM Generation</td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.crossEncoder.error ? "N/A" : formatLatency(comparisonResult.crossEncoder.generationLatencyMs)}
                        </td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.laya.error ? "N/A" : formatLatency(comparisonResult.laya.generationLatencyMs)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-text-secondary font-sans font-medium">Total Latency</td>
                        <td className="py-2 px-3 text-text-primary font-semibold">
                          {comparisonResult.crossEncoder.error ? "N/A — failed" : formatLatency(comparisonResult.crossEncoder.totalLatencyMs)}
                        </td>
                        <td className="py-2 px-3 text-text-primary font-semibold">
                          {comparisonResult.laya.error ? "N/A — failed" : formatLatency(comparisonResult.laya.totalLatencyMs)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Token Counts */}
              <div className="space-y-2">
                <h4 className="font-semibold text-text-primary text-xs">
                  Token Counts
                </h4>
                <div className="border border-border rounded-lg bg-white overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/30 text-text-muted">
                        <th className="py-2 px-3 text-left font-normal">Token Type</th>
                        <th className="py-2 px-3 text-left font-normal">Cross-Encoder</th>
                        <th className="py-2 px-3 text-left font-normal">Laya</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                      <tr>
                        <td className="py-2 px-3 text-text-secondary font-sans">Prompt Tokens</td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.crossEncoder.error ? "N/A" : formatTokens(comparisonResult.crossEncoder.promptTokens)}
                        </td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.laya.error ? "N/A" : formatTokens(comparisonResult.laya.promptTokens)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-text-secondary font-sans">Completion Tokens</td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.crossEncoder.error ? "N/A" : formatTokens(comparisonResult.crossEncoder.completionTokens)}
                        </td>
                        <td className="py-2 px-3 text-text-primary">
                          {comparisonResult.laya.error ? "N/A" : formatTokens(comparisonResult.laya.completionTokens)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-text-secondary font-sans font-medium">Total Tokens</td>
                        <td className="py-2 px-3 text-text-primary font-semibold">
                          {comparisonResult.crossEncoder.error ? "N/A" : formatTokens(comparisonResult.crossEncoder.totalTokens)}
                        </td>
                        <td className="py-2 px-3 text-text-primary font-semibold">
                          {comparisonResult.laya.error ? "N/A" : formatTokens(comparisonResult.laya.totalTokens)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Context Viewer Modal Triggers */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenContextViewer("a")}
                  className="text-xs"
                >
                  View Cross-Encoder LLM Prompt Context
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenContextViewer("b")}
                  className="text-xs"
                >
                  View Laya LLM Prompt Context
                </Button>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
