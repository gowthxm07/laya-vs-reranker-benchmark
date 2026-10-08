"use client";

import * as React from "react";
import { ComparisonResult } from "@/lib/types/comparison";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { formatLatency } from "@/lib/utils/formatters";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

interface RelevanceEnginesSectionProps {
  comparisonResult?: ComparisonResult | null;
  candidatePool?: CandidateChunkPool | null;
  onViewCrossEncoderPassages: () => void;
  onViewLayaPassages: () => void;
}

export function RelevanceEnginesSection({
  comparisonResult,
  candidatePool,
  onViewCrossEncoderPassages,
  onViewLayaPassages,
}: RelevanceEnginesSectionProps) {
  const [expandedChunks, setExpandedChunks] = React.useState<Record<string, boolean>>({});

  const toggleChunk = (id: string) => {
    setExpandedChunks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const pool = comparisonResult?.sharedRetrieval?.candidatePool || candidatePool;
  const candidates = pool?.candidateChunks || [];

  const ceSelectedIds = React.useMemo(() => {
    if (!comparisonResult) return new Set<string>();
    return new Set(comparisonResult.crossEncoder.selectedChunkIds);
  }, [comparisonResult]);

  const layaSelectedIds = React.useMemo(() => {
    if (!comparisonResult) return new Set<string>();
    return new Set(comparisonResult.laya.selectedChunkIds);
  }, [comparisonResult]);

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div>
        <h2 className="text-xs font-mono font-semibold tracking-wider text-accent uppercase">
          03 — RELEVANCE ENGINES
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Both strategies evaluate the same retrieved candidate passages.
        </p>
      </div>

      {!comparisonResult ? (
        /* Empty State */
        <div className="border border-dashed border-border rounded-lg p-8 bg-white text-center">
          <p className="text-sm text-text-muted">
            Run a comparison to evaluate both relevance strategies.
          </p>
        </div>
      ) : (
        /* Populated Engines Comparison View */
        <div className="space-y-6">
          {/* Side-by-Side Strategy Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Cross-Encoder */}
            <div className="border border-border rounded-lg p-5 bg-white space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Cross-Encoder
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Reranking
                    </p>
                  </div>
                  <span className="text-xs font-mono text-text-muted">
                    ms-marco-MiniLM-L-6-v2
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="text-lg font-semibold text-text-primary">
                    {comparisonResult.crossEncoder.retainedCount} selected / {comparisonResult.sharedRetrieval.candidateCount}
                  </div>
                  <div className="text-xs text-text-muted font-mono">
                    Evaluation latency: {formatLatency(comparisonResult.crossEncoder.relevanceLatencyMs)}
                  </div>
                </div>
              </div>

              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onViewCrossEncoderPassages}
                  className="text-xs w-full sm:w-auto"
                >
                  View passages
                </Button>
              </div>
            </div>

            {/* Right: Laya */}
            <div className="border border-border rounded-lg p-5 bg-white space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Laya
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Relevance filtering
                    </p>
                  </div>
                  <span className="text-xs font-mono text-text-muted">
                    Non-autoregressive gating
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="text-lg font-semibold text-text-primary">
                    {comparisonResult.laya.retainedCount} kept / {comparisonResult.sharedRetrieval.candidateCount}
                  </div>
                  <div className="text-xs text-text-muted font-mono">
                    Evaluation latency: {formatLatency(comparisonResult.laya.relevanceLatencyMs)}
                  </div>
                </div>
              </div>

              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onViewLayaPassages}
                  className="text-xs w-full sm:w-auto"
                >
                  View passages
                </Button>
              </div>
            </div>
          </div>

          {/* Compact Chunk Decision Details */}
          {candidates.length > 0 && (
            <div className="border border-border rounded-lg bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-elevated/40 flex items-center justify-between text-xs">
                <span className="font-semibold text-text-primary">
                  Candidate Decisions ({candidates.length} passages)
                </span>
                <span className="text-text-muted text-[11px]">
                  Shared candidate pool alignment
                </span>
              </div>

              <div className="divide-y divide-border/60 text-xs">
                {candidates.map((chunk, idx) => {
                  const chunkId = chunk.id || `chunk-${idx}`;
                  const isCESelected = ceSelectedIds.has(chunk.id);
                  const isLayaKept = layaSelectedIds.has(chunk.id);
                  const isExpanded = !!expandedChunks[chunkId];

                  // Ground truth detection
                  const isGTKnown =
                    chunk.metadata?.isRelevant !== undefined ||
                    chunk.metadata?.groundTruthRelevance !== undefined;
                  const isGTRelevant =
                    chunk.metadata?.isRelevant === true ||
                    chunk.metadata?.groundTruthRelevance === true;

                  const chunkLabel = `Chunk ${String(idx + 1).padStart(2, "0")}`;

                  return (
                    <div key={chunkId} className="p-3 hover:bg-surface-elevated/20 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Left metadata info */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleChunk(chunkId)}
                            className="inline-flex items-center gap-1 font-mono font-medium text-text-primary hover:text-accent"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                            )}
                            <span>{chunkLabel}</span>
                          </button>

                          {chunk.pageNumber && (
                            <span className="text-[11px] text-text-muted font-mono">
                              p.{chunk.pageNumber}
                            </span>
                          )}
                        </div>

                        {/* Decisions row */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px]">
                          <div>
                            <span className="text-text-muted mr-1">Cross-Encoder:</span>
                            <span className={isCESelected ? "text-emerald-700 font-medium" : "text-text-muted"}>
                              {isCESelected ? "Selected" : "Discarded"}
                            </span>
                          </div>

                          <span className="text-border">•</span>

                          <div>
                            <span className="text-text-muted mr-1">Laya:</span>
                            <span className={isLayaKept ? "text-emerald-700 font-medium" : "text-text-muted"}>
                              {isLayaKept ? "KEEP" : "DROP"}
                            </span>
                          </div>

                          {isGTKnown && (
                            <>
                              <span className="text-border">•</span>
                              <div>
                                <span className="text-text-muted mr-1">Ground Truth:</span>
                                <span className={isGTRelevant ? "text-emerald-700 font-medium" : "text-text-secondary"}>
                                  {isGTRelevant ? "Relevant" : "Distractor"}
                                </span>
                              </div>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleChunk(chunkId)}
                            className="text-accent hover:underline text-[11px] ml-1"
                          >
                            {isExpanded ? "Collapse" : "View passage"}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Passage Text */}
                      {isExpanded && (
                        <div className="mt-2.5 p-3 rounded bg-surface-subtle border border-border/70 text-xs text-text-secondary leading-relaxed font-mono">
                          <div className="flex items-center gap-1.5 text-[11px] text-text-muted mb-1.5 font-sans">
                            <FileText className="h-3 w-3" />
                            <span>{chunk.source || chunk.documentId || "Document excerpt"}</span>
                            {chunk.section && <span>§ {chunk.section}</span>}
                          </div>
                          <p className="whitespace-pre-wrap">{chunk.text}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
