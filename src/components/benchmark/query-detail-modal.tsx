"use client";

import * as React from "react";
import { QueryBenchmarkResult } from "@/lib/types/benchmark";
import { X, CheckCircle, AlertTriangle, Split, ChevronDown, ChevronUp } from "lucide-react";

interface QueryDetailModalProps {
  result: QueryBenchmarkResult | null;
  onClose: () => void;
}

export function QueryDetailModal({ result, onClose }: QueryDetailModalProps) {
  const [activeTab, setActiveTab] = React.useState<"overview" | "decisions" | "answers">("overview");
  const [expandedChunkId, setExpandedChunkId] = React.useState<string | null>(null);

  if (!result) return null;

  const ce = result.crossEncoder;
  const laya = result.laya;
  const gt = result.groundTruth;

  // Derive candidate decisions if not provided in historical runs
  const decisions = result.candidateDecisions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-elevated/40">
          <div>
            <div className="flex flex-wrap items-center gap-2">
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
            aria-label="Close modal"
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
            onClick={() => setActiveTab("decisions")}
            className={`py-2.5 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "decisions"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <Split className="h-3.5 w-3.5" />
            <span>Chunk-by-Chunk Decisions</span>
            {decisions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-surface-elevated border border-border">
                {decisions.length}
              </span>
            )}
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
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: OVERVIEW & METRICS */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Ground Truth Reference */}
              <div className="p-3.5 rounded-lg border border-border bg-surface-elevated/20 space-y-2">
                <div className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-accent" />
                  <span>Ground Truth Reference Specification</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-text-muted">Target Relevant Chunks: </span>
                    <span className="font-mono text-text-primary">
                      {gt.relevantChunkIds.length > 0
                        ? gt.relevantChunkIds.join(", ")
                        : "None (Intentional Distractor / No-Answer Case)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Required Fact Tokens: </span>
                    <span className="font-mono text-text-primary">
                      {gt.requiredFacts.length > 0
                        ? gt.requiredFacts.join(", ")
                        : "None (Refusal Expected)"}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-canvas border border-border text-text-secondary italic">
                  &ldquo;{gt.referenceAnswer}&rdquo;
                </div>
              </div>

              {/* Head-to-Head Metric Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-left font-mono">
                  <thead className="bg-surface-elevated text-text-muted text-[10px] uppercase border-b border-border">
                    <tr>
                      <th className="p-2.5">Evaluation Dimension</th>
                      <th className="p-2.5">Cross-Encoder (Path A)</th>
                      <th className="p-2.5">Laya RAG (Path B)</th>
                      <th className="p-2.5">Difference / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-[11px]">
                    <tr>
                      <td className="p-2.5 text-text-secondary">Relevance Precision</td>
                      <td className="p-2.5 text-text-primary font-semibold">{ce.relevanceMetrics.precision.toFixed(4)}</td>
                      <td className="p-2.5 text-text-primary font-semibold">{laya.relevanceMetrics.precision.toFixed(4)}</td>
                      <td className="p-2.5 text-text-muted">
                        {result.pairedDifferences.precisionDiff > 0 ? `+${result.pairedDifferences.precisionDiff}` : result.pairedDifferences.precisionDiff}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Relevance Recall</td>
                      <td className="p-2.5 text-text-primary font-semibold">{ce.relevanceMetrics.recall.toFixed(4)}</td>
                      <td className="p-2.5 text-text-primary font-semibold">{laya.relevanceMetrics.recall.toFixed(4)}</td>
                      <td className="p-2.5 text-text-muted">
                        {result.pairedDifferences.recallDiff > 0 ? `+${result.pairedDifferences.recallDiff}` : result.pairedDifferences.recallDiff}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Relevance F1 Score</td>
                      <td className="p-2.5 text-text-primary font-bold">{ce.relevanceMetrics.f1.toFixed(4)}</td>
                      <td className="p-2.5 text-text-primary font-bold">{laya.relevanceMetrics.f1.toFixed(4)}</td>
                      <td className="p-2.5 text-accent font-semibold">
                        {result.pairedDifferences.f1Diff > 0 ? `+${result.pairedDifferences.f1Diff}` : result.pairedDifferences.f1Diff}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">MRR / NDCG</td>
                      <td className="p-2.5 text-text-primary">
                        MRR: {ce.relevanceMetrics.mrr ?? "N/A"} | NDCG: {ce.relevanceMetrics.ndcg ?? "N/A"}
                      </td>
                      <td className="p-2.5 text-text-muted italic">
                        N/A (Unordered Binary Gating)
                      </td>
                      <td className="p-2.5 text-text-muted">
                        Ranking metrics apply strictly to ordered permutations
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Retained Chunks</td>
                      <td className="p-2.5 text-text-primary">{ce.contextMetrics.retainedCount} of {result.initialCandidateCount}</td>
                      <td className="p-2.5 text-text-primary">{laya.contextMetrics.retainedCount} of {result.initialCandidateCount}</td>
                      <td className="p-2.5 text-text-muted">Delta: {ce.contextMetrics.retainedCount - laya.contextMetrics.retainedCount}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Context Reduction %</td>
                      <td className="p-2.5 text-text-primary">{ce.contextMetrics.contextReductionPercent.toFixed(1)}%</td>
                      <td className="p-2.5 text-emerald-400 font-semibold">{laya.contextMetrics.contextReductionPercent.toFixed(1)}%</td>
                      <td className="p-2.5 text-text-muted">{result.pairedDifferences.contextReductionDiff.toFixed(1)}%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Relevance Latency</td>
                      <td className="p-2.5 text-emerald-400">{ce.latencies.relevanceMs} ms</td>
                      <td className="p-2.5 text-text-primary">{laya.latencies.relevanceMs} ms</td>
                      <td className="p-2.5 text-text-muted">{result.pairedDifferences.relevanceLatencyDiffMs} ms</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Total Path Latency</td>
                      <td className="p-2.5 text-text-primary">{ce.latencies.totalMs} ms</td>
                      <td className="p-2.5 text-text-primary">{laya.latencies.totalMs} ms</td>
                      <td className="p-2.5 text-text-muted">{result.pairedDifferences.totalLatencyDiffMs} ms</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Total Tokens (Prompt / Compl)</td>
                      <td className="p-2.5 text-text-primary">{ce.tokens.total} ({ce.tokens.prompt} / {ce.tokens.completion})</td>
                      <td className="p-2.5 text-text-primary">{laya.tokens.total} ({laya.tokens.prompt} / {laya.tokens.completion})</td>
                      <td className="p-2.5 text-text-muted">{result.pairedDifferences.tokenDiff} tokens</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Fact Coverage</td>
                      <td className="p-2.5 text-text-primary font-semibold">{(ce.answerMetrics.factCoverage * 100).toFixed(0)}%</td>
                      <td className="p-2.5 text-text-primary font-semibold">{(laya.answerMetrics.factCoverage * 100).toFixed(0)}%</td>
                      <td className="p-2.5 text-text-muted">Presence of required key facts</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-text-secondary">Lexical Groundedness</td>
                      <td className="p-2.5 text-text-primary font-semibold">
                        {((ce.answerMetrics.lexicalGroundednessScore ?? ce.answerMetrics.faithfulnessScore) * 100).toFixed(0)}%
                      </td>
                      <td className="p-2.5 text-text-primary font-semibold">
                        {((laya.answerMetrics.lexicalGroundednessScore ?? laya.answerMetrics.faithfulnessScore) * 100).toFixed(0)}%
                      </td>
                      <td className="p-2.5 text-text-muted">Token overlap with selected context</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Failure Diagnostics */}
              <div className="p-3.5 rounded-lg border border-border bg-surface-elevated/20 text-[11px] space-y-1.5">
                <div className="font-semibold text-text-secondary flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span>Analytical Diagnostic Notes</span>
                </div>
                <p className="text-text-muted leading-relaxed">{result.failureAnalysis.notes}</p>
              </div>
            </div>
          )}

          {/* TAB 2: CHUNK-BY-CHUNK DECISIONS (Side-by-side inspection) */}
          {activeTab === "decisions" && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-border bg-surface-elevated/20 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-text-primary text-xs">
                    Candidate Chunk Decision Alignment
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Direct comparison of Cross-Encoder ranking signal vs Laya binary gating for each candidate chunk.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ground-Truth Relevant
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-500" /> Distractor
                  </span>
                </div>
              </div>

              {decisions.length === 0 ? (
                // Fallback for legacy runs without candidateDecisions: show retained ID lists
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h5 className="font-mono text-xs font-semibold text-accent">Cross-Encoder Retained Chunks ({ce.selectedChunkIds.length})</h5>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      {ce.selectedChunkIds.map((id, i) => (
                        <div key={id} className="p-2 rounded border border-border bg-surface flex justify-between">
                          <span>#{i + 1} {id}</span>
                          <span className={gt.relevantChunkIds.includes(id) ? "text-emerald-400" : "text-text-muted"}>
                            {gt.relevantChunkIds.includes(id) ? "RELEVANT" : "DISTRACTOR"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h5 className="font-mono text-xs font-semibold text-accent">Laya Retained Chunks ({laya.selectedChunkIds.length})</h5>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      {laya.selectedChunkIds.map((id, i) => (
                        <div key={id} className="p-2 rounded border border-border bg-surface flex justify-between">
                          <span>#{i + 1} {id}</span>
                          <span className={gt.relevantChunkIds.includes(id) ? "text-emerald-400" : "text-text-muted"}>
                            {gt.relevantChunkIds.includes(id) ? "RELEVANT" : "DISTRACTOR"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {decisions.map((chunk, index) => {
                    const isExpanded = expandedChunkId === chunk.id;
                    const isGT = chunk.isGroundTruthRelevant;
                    const ceSelected = chunk.crossEncoder.selected;
                    const layaKept = chunk.laya.decision === "keep";

                    // Determine alignment tag
                    let tagText = "Both Selected";
                    let tagClass = "border-border text-text-secondary bg-surface";
                    if (ceSelected && layaKept) {
                      tagText = isGT ? "Agreement (Both Retained)" : "Both Retained (False Positive)";
                      tagClass = isGT ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/10" : "border-amber-500/40 text-amber-300 bg-amber-950/10";
                    } else if (ceSelected && !layaKept) {
                      tagText = isGT ? "Laya False Negative" : "Laya Filtered Distractor";
                      tagClass = isGT ? "border-rose-500/40 text-rose-300 bg-rose-950/10" : "border-accent/40 text-accent bg-accent-subtle/20";
                    } else if (!ceSelected && layaKept) {
                      tagText = isGT ? "Laya Rescued Relevant" : "Laya False Positive";
                      tagClass = isGT ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/10" : "border-rose-500/40 text-rose-300 bg-rose-950/10";
                    } else {
                      tagText = isGT ? "Both Missed (False Negative)" : "Agreement (Both Discarded)";
                      tagClass = isGT ? "border-rose-500/40 text-rose-300 bg-rose-950/10" : "border-border text-text-muted bg-surface/50";
                    }

                    return (
                      <div
                        key={chunk.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isGT
                            ? "border-emerald-500/30 bg-emerald-950/5"
                            : "border-border bg-surface"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-muted text-[11px]">
                              #{String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="font-mono font-semibold text-text-primary text-xs">
                              {chunk.id}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                                isGT
                                  ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-400 font-semibold"
                                  : "border-border-subtle bg-surface-elevated/40 text-text-muted"
                              }`}
                            >
                              {isGT ? "GROUND TRUTH: RELEVANT" : "DISTRACTOR"}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${tagClass}`}>
                              {tagText}
                            </span>
                          </div>

                          {/* Decisions Strip */}
                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            {/* Cross-Encoder Decision */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-text-muted text-[10px]">CE:</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  ceSelected
                                    ? "bg-accent/20 text-accent border border-accent/30"
                                    : "bg-surface-elevated text-text-muted border border-border"
                                }`}
                              >
                                {ceSelected ? "Selected" : "Filtered"}
                              </span>
                              {chunk.crossEncoder.score !== undefined && (
                                <span className="text-[10px] text-text-muted">
                                  ({chunk.crossEncoder.score > 0 ? `+${chunk.crossEncoder.score.toFixed(2)}` : chunk.crossEncoder.score.toFixed(2)})
                                </span>
                              )}
                            </div>

                            {/* Laya Decision */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-text-muted text-[10px]">Laya:</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  layaKept
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                                }`}
                              >
                                {layaKept ? "KEEP" : "DROP"}
                              </span>
                            </div>

                            {/* Expand snippet button */}
                            <button
                              onClick={() => setExpandedChunkId(isExpanded ? null : chunk.id)}
                              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated"
                              aria-label={isExpanded ? "Collapse chunk text" : "Expand chunk text"}
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Passage Snippet */}
                        <div className="mt-2 text-text-secondary text-[11px] leading-relaxed font-sans">
                          {isExpanded ? (
                            <p className="whitespace-pre-wrap">{chunk.fullText || chunk.textSnippet}</p>
                          ) : (
                            <p className="line-clamp-2">{chunk.textSnippet}</p>
                          )}
                        </div>

                        <div className="mt-1 text-[10px] font-mono text-text-muted">
                          Source: {chunk.source} (Page {chunk.pageNumber})
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SIDE-BY-SIDE ANSWERS */}
          {activeTab === "answers" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Path A Answer */}
                <div className="p-3.5 rounded-lg border border-border bg-surface-elevated/20 flex flex-col space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border pb-2 font-mono text-[11px]">
                    <span className="font-semibold text-accent">Cross-Encoder (Path A)</span>
                    <span className="text-text-muted">{ce.latencies.generationMs} ms generation</span>
                  </div>
                  <div className="p-3 rounded bg-canvas border border-border text-text-primary whitespace-pre-wrap leading-relaxed flex-1 text-xs">
                    {ce.answer || "No answer generated"}
                  </div>
                  <div className="p-2 rounded bg-surface border border-border-subtle grid grid-cols-2 gap-2 text-[10px] font-mono text-text-muted">
                    <div>
                      <span>Fact Coverage: </span>
                      <span className="font-semibold text-text-primary">{(ce.answerMetrics.factCoverage * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span>Lexical Groundedness: </span>
                      <span className="font-semibold text-text-primary">
                        {((ce.answerMetrics.lexicalGroundednessScore ?? ce.answerMetrics.faithfulnessScore) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Path B Answer */}
                <div className="p-3.5 rounded-lg border border-border bg-surface-elevated/20 flex flex-col space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border pb-2 font-mono text-[11px]">
                    <span className="font-semibold text-accent">Laya RAG (Path B)</span>
                    <span className="text-text-muted">{laya.latencies.generationMs} ms generation</span>
                  </div>
                  <div className="p-3 rounded bg-canvas border border-border text-text-primary whitespace-pre-wrap leading-relaxed flex-1 text-xs">
                    {laya.answer || "No answer generated"}
                  </div>
                  <div className="p-2 rounded bg-surface border border-border-subtle grid grid-cols-2 gap-2 text-[10px] font-mono text-text-muted">
                    <div>
                      <span>Fact Coverage: </span>
                      <span className="font-semibold text-text-primary">{(laya.answerMetrics.factCoverage * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span>Lexical Groundedness: </span>
                      <span className="font-semibold text-text-primary">
                        {((laya.answerMetrics.lexicalGroundednessScore ?? laya.answerMetrics.faithfulnessScore) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference Answer Comparison Strip */}
              <div className="p-3 rounded-lg border border-border bg-surface text-xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted">Reference Answer:</span>
                <p className="text-text-secondary italic">&ldquo;{gt.referenceAnswer}&rdquo;</p>
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
