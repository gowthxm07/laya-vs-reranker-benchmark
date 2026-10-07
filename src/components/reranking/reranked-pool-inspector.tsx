"use client";

import * as React from "react";
import { RerankedCandidatePool } from "@/lib/types/reranker";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatScore, formatLatency } from "@/lib/utils/formatters";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  GitCommit,
} from "lucide-react";

interface RerankedPoolInspectorProps {
  rerankedPool: RerankedCandidatePool | null;
  isLoading?: boolean;
}

export function RerankedPoolInspector({
  rerankedPool,
  isLoading: _isLoading = false,
}: RerankedPoolInspectorProps) {
  const [expandedChunkIds, setExpandedChunkIds] = React.useState<Set<string>>(
    new Set()
  );

  const toggleExpand = (id: string) => {
    setExpandedChunkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!rerankedPool) return null;

  const { metrics, candidates } = rerankedPool;

  return (
    <Card className="bg-surface border border-accent/40 shadow-panel">
      {/* Header */}
      <CardHeader className="p-4 bg-canvas-subtle/80 border-b border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Cross-Encoder Reranked Results (Path A Baseline)
            </h2>
            <Badge variant="accent" size="sm" className="font-mono">
              Top-{rerankedPool.topNSelected} Selected
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-text-secondary" />
              Scoring Latency:{" "}
              <strong className="text-text-primary">
                {formatLatency(metrics.evaluationLatencyMs)}
              </strong>
            </span>
            <span>•</span>
            <span title="Average latency per candidate chunk">
              Avg/Chunk:{" "}
              <strong className="text-text-secondary">
                {metrics.averageCandidateLatencyMs}ms
              </strong>
            </span>
            {metrics.modelLoadLatencyMs && metrics.modelLoadLatencyMs > 0 && (
              <>
                <span>•</span>
                <span title="Cold-start model load time">
                  Load:{" "}
                  <span className="text-text-muted">
                    {formatLatency(metrics.modelLoadLatencyMs)}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Path A Decision Trace Strip */}
        <div className="p-2.5 rounded border border-border/80 bg-surface-subtle/60 text-[11px] font-mono text-text-muted flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <GitCommit className="h-3.5 w-3.5 text-accent" />
            <span className="text-text-secondary font-medium">Path A Trace:</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-surface border border-border/60 text-text-primary">
              Candidate Pool ({rerankedPool.topKRetrieved})
            </span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-accent-subtle border border-accent-border text-blue-300">
              Cross-Encoder ({rerankedPool.crossEncoderModel.split("/").pop()})
            </span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
              Reranked Top-{rerankedPool.topNSelected} Selected
            </span>
          </div>
        </div>

        {/* Summary note */}
        <p className="text-[11px] text-text-muted leading-relaxed">
          The cross-encoder jointly scored (query, candidate) pairs via deep cross-attention.
          Raw logit scores reflect relative semantic ranking signals. The highest-ranked {rerankedPool.topNSelected} candidates are marked for downstream context inclusion.
        </p>
      </CardHeader>

      {/* Reranked Chunks List */}
      <CardContent className="p-4 space-y-2.5 max-h-[600px] overflow-y-auto">
        {candidates.map((chunk) => {
          const isExpanded = expandedChunkIds.has(chunk.id);
          const rankMovedUp = chunk.rankDelta > 0;
          const rankMovedDown = chunk.rankDelta < 0;

          return (
            <div
              key={chunk.id}
              className={`p-3 rounded border transition-colors text-xs space-y-2 ${
                chunk.isSelected
                  ? "bg-surface-elevated/60 border-accent/40 hover:border-accent"
                  : "bg-surface-subtle/30 border-border/70 opacity-75 hover:opacity-100"
              }`}
            >
              {/* Top row: Ranks, Scores, and Selection Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* New Rank */}
                  <span className="font-mono text-xs font-bold text-text-primary">
                    Rank #{chunk.rerankedRank}
                  </span>

                  {/* Rank Delta Badge */}
                  {rankMovedUp && (
                    <Badge variant="success" size="sm" className="gap-0.5 text-[10px]">
                      <ArrowUp className="h-2.5 w-2.5" /> +{chunk.rankDelta} pos
                    </Badge>
                  )}
                  {rankMovedDown && (
                    <Badge variant="outline" size="sm" className="gap-0.5 text-[10px] text-amber-400 border-amber-900/60">
                      <ArrowDown className="h-2.5 w-2.5" /> {chunk.rankDelta} pos
                    </Badge>
                  )}
                  {chunk.rankDelta === 0 && (
                    <Badge variant="muted" size="sm" className="gap-0.5 text-[10px]">
                      <Minus className="h-2.5 w-2.5" /> unchanged
                    </Badge>
                  )}

                  <span className="text-text-muted">•</span>
                  <span className="font-medium text-text-primary truncate max-w-[200px]">
                    {chunk.source || chunk.documentId}
                  </span>
                  {chunk.pageNumber !== undefined && (
                    <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                      Page {chunk.pageNumber}
                    </Badge>
                  )}
                </div>

                {/* Score Comparison & Decision */}
                <div className="flex items-center gap-2.5 font-mono text-[11px]">
                  <span className="text-text-muted">
                    Orig Cosine:{" "}
                    <span className="text-text-secondary">
                      {formatScore(chunk.originalRetrievalScore, 3)}
                    </span>
                  </span>
                  <span>→</span>
                  <span className="text-text-secondary">
                    CE Score:{" "}
                    <strong className="text-accent text-xs">
                      {chunk.crossEncoderScore > 0 ? `+${chunk.crossEncoderScore.toFixed(3)}` : chunk.crossEncoderScore.toFixed(3)}
                    </strong>
                  </span>
                  {chunk.isSelected ? (
                    <Badge variant="success" size="sm" className="gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Selected (Top-N)
                    </Badge>
                  ) : (
                    <Badge variant="muted" size="sm" className="gap-1">
                      <XCircle className="h-2.5 w-2.5" /> Filtered Out
                    </Badge>
                  )}
                </div>
              </div>

              {/* Chunk Text */}
              <div
                className={`font-mono text-[11px] text-text-secondary leading-relaxed bg-canvas-subtle/60 p-2.5 rounded border border-border/30 whitespace-pre-wrap ${
                  !isExpanded ? "line-clamp-3" : ""
                }`}
              >
                {chunk.text}
              </div>

              {/* Expand Toggle */}
              <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
                <span>
                  Initial Vector Rank: #{chunk.originalRank}
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpand(chunk.id)}
                  className="hover:text-text-primary flex items-center gap-1 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <span>Collapse</span>
                      <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      <span>Expand ({chunk.text.length} chars)</span>
                      <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
