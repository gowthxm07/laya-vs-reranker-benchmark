"use client";

import * as React from "react";
import { LayaFilteredPool } from "@/lib/types/laya";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatScore, formatLatency } from "@/lib/utils/formatters";
import {
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  GitCommit,
  Percent,
} from "lucide-react";

interface LayaFilteredPoolInspectorProps {
  layaPool: LayaFilteredPool | null;
  isLoading?: boolean;
}

export function LayaFilteredPoolInspector({
  layaPool,
  isLoading: _isLoading = false,
}: LayaFilteredPoolInspectorProps) {
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

  if (!layaPool) return null;

  const { metrics, candidates } = layaPool;

  return (
    <Card className="bg-surface border border-emerald-500/40 shadow-panel">
      {/* Header */}
      <CardHeader className="p-4 bg-canvas-subtle/80 border-b border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Laya Relevance Filtering Results (Path B)
            </h2>
            <Badge variant="success" size="sm" className="font-mono">
              {layaPool.retainedCount}/{layaPool.totalCandidates} Retained
            </Badge>
            <Badge variant="outline" size="sm" className="font-mono gap-1 text-emerald-400 border-emerald-900/60">
              <Percent className="h-2.5 w-2.5" />
              {layaPool.contextReductionPercent}% Pruned
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-text-secondary" />
              Evaluation Latency:{" "}
              <strong className="text-text-primary">
                {formatLatency(metrics.evaluationLatencyMs)}
              </strong>
            </span>
            <span>•</span>
            <span title="Average latency per candidate passage">
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

        {/* Path B Decision Trace Strip */}
        <div className="p-2.5 rounded border border-border/80 bg-surface-subtle/60 text-[11px] font-mono text-text-muted flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <GitCommit className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-text-secondary font-medium">Path B Trace:</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-1.5 py-0.5 rounded bg-surface border border-border/60 text-text-primary">
              Candidate Pool ({layaPool.totalCandidates})
            </span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
              Laya Evaluator (System 1 Choice)
            </span>
            <span>→</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300">
              KEEP ({layaPool.retainedCount}) / DROP ({layaPool.discardedCount})
            </span>
          </div>
        </div>

        {/* Summary note */}
        <p className="text-[11px] text-text-muted leading-relaxed">
          Laya evaluated candidate passages using non-autoregressive System 1 decisions.
          Passages classified as <strong>KEEP</strong> are preserved for downstream prompt context; passages classified as <strong>DROP</strong> are eliminated, achieving {layaPool.contextReductionPercent}% semantic context reduction without secondary retrieval.
        </p>
      </CardHeader>

      {/* Evaluated Chunks List */}
      <CardContent className="p-4 space-y-2.5 max-h-[600px] overflow-y-auto">
        {candidates.map((chunk) => {
          const isExpanded = expandedChunkIds.has(chunk.id);
          const isKeep = chunk.layaDecision === "keep";

          return (
            <div
              key={chunk.id}
              className={`p-3 rounded border transition-colors text-xs space-y-2 ${
                isKeep
                  ? "bg-surface-elevated/60 border-emerald-500/40 hover:border-emerald-400"
                  : "bg-surface-subtle/30 border-border/70 opacity-75 hover:opacity-100"
              }`}
            >
              {/* Top row: Rank, Decision Badge, and Probability */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-text-primary">
                    Candidate #{chunk.originalRank}
                  </span>
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

                {/* Score & Laya Decision */}
                <div className="flex items-center gap-2.5 font-mono text-[11px]">
                  <span className="text-text-muted">
                    Cosine Sim:{" "}
                    <span className="text-text-secondary">
                      {formatScore(chunk.originalRetrievalScore, 3)}
                    </span>
                  </span>
                  <span>•</span>
                  {chunk.keepProbability !== undefined && (
                    <span className="text-text-muted">
                      P(keep):{" "}
                      <strong className={isKeep ? "text-emerald-400" : "text-text-secondary"}>
                        {(chunk.keepProbability * 100).toFixed(1)}%
                      </strong>
                    </span>
                  )}
                  {isKeep ? (
                    <Badge variant="success" size="sm" className="gap-1 bg-emerald-950/80 text-emerald-300 border-emerald-700/60">
                      <CheckCircle2 className="h-2.5 w-2.5" /> KEEP (Retained)
                    </Badge>
                  ) : (
                    <Badge variant="danger" size="sm" className="gap-1 bg-rose-950/60 text-rose-300 border-rose-800/60">
                      <XCircle className="h-2.5 w-2.5" /> DROP (Filtered)
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
                  ID: {chunk.id}
                  {chunk.layaConfidence !== undefined && (
                    <span className="ml-2">
                      • Confidence: {chunk.layaConfidence.toFixed(4)}
                    </span>
                  )}
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
