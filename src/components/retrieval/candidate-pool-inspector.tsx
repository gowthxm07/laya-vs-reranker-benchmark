"use client";

import * as React from "react";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatScore, formatLatency } from "@/lib/utils/formatters";
import {
  Layers,
  ChevronDown,
  ChevronUp,
  FileCode,
  Clock,
  Scale,
  ArrowUpDown,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CandidatePoolInspectorProps {
  pool?: CandidateChunkPool | null;
  isLoading?: boolean;
  onRunRerank?: (topN: number) => void;
  isReranking?: boolean;
  topN?: number;
  onTopNChange?: (topN: number) => void;
  hasReranked?: boolean;
  onRunLayaFilter?: () => void;
  isFilteringLaya?: boolean;
  hasLayaFiltered?: boolean;
}

export function CandidatePoolInspector({
  pool,
  isLoading: _isLoading = false,
  onRunRerank,
  isReranking = false,
  topN = 5,
  onTopNChange,
  hasReranked = false,
  onRunLayaFilter,
  isFilteringLaya = false,
  hasLayaFiltered = false,
}: CandidatePoolInspectorProps) {
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

  const expandAll = () => {
    if (!pool) return;
    setExpandedChunkIds(new Set(pool.candidateChunks.map((c) => c.id)));
  };

  const collapseAll = () => {
    setExpandedChunkIds(new Set());
  };

  if (!pool || pool.candidateChunks.length === 0) {
    return (
      <Card className="bg-surface border border-border">
        <CardHeader className="p-4 border-b border-border/70 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Shared Candidate Chunk Pool
            </h2>
          </div>
          <Badge variant="muted" size="sm">
            Status: Awaiting Retrieval
          </Badge>
        </CardHeader>
        <CardContent className="p-8 text-center flex flex-col items-center justify-center">
          <FileCode className="h-8 w-8 text-text-muted mb-2 opacity-50" />
          <p className="text-xs font-medium text-text-secondary">
            No candidate chunks retrieved yet
          </p>
          <p className="text-[11px] text-text-muted max-w-md mt-1 leading-relaxed">
            Ingest a document or select a sample dataset above, enter a question, and click{" "}
            <strong className="text-text-secondary font-medium">Retrieve Candidates</strong>. The resulting vector candidate pool will be inspected here before any post-retrieval relevance evaluation is applied.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface border border-border shadow-panel">
      {/* Pool Header */}
      <CardHeader className="p-4 bg-canvas-subtle/60 border-b border-border space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Shared Candidate Chunk Pool
            </h2>
            <span className="text-xs text-text-muted">•</span>
            <Badge variant="accent" size="sm" className="font-mono">
              Top-{pool.candidateChunks.length} Retrieved
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-text-secondary" />
              Retrieval Latency:{" "}
              <strong className="text-text-primary">
                {formatLatency(pool.retrievalLatencyMs)}
              </strong>
            </span>
            <span>•</span>
            <span>
              Model: <strong className="text-text-secondary">{pool.embeddingModel}</strong>
            </span>
          </div>
        </div>

        {/* Scientific Control Note */}
        <div className="p-2.5 rounded border border-border/80 bg-surface-subtle/50 text-[11px] text-text-secondary flex items-start gap-2">
          <Scale className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
          <span>
            <strong className="text-text-primary">Experimental Control Notice:</strong>{" "}
            This exact candidate chunk pool is shared across both pipelines. In Phase 3,{" "}
            <strong className="text-text-primary">Cross-Encoder</strong> re-scores these candidates. In Phase 4,{" "}
            <strong className="text-text-primary">Laya</strong> will prune them. Initial ranks and retrieval scores reflect raw bi-encoder cosine similarity.
          </span>
        </div>

        {/* Phase 3 Action Bar: Cross-Encoder Rerank Trigger */}
        {onRunRerank && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface-elevated/70 rounded-md border border-accent/30 text-xs">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-accent shrink-0" />
              <div>
                <span className="font-semibold text-text-primary">
                  Path A Evaluation: Cross-Encoder Reranking
                </span>
                <span className="text-text-muted ml-1.5 hidden sm:inline">
                  (cross-encoder/ms-marco-MiniLM-L-6-v2)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
                <label htmlFor="topN-select" className="text-text-muted">
                  Top-N:
                </label>
                <select
                  id="topN-select"
                  value={topN}
                  onChange={(e) => onTopNChange?.(Number(e.target.value))}
                  disabled={isReranking}
                  className="bg-canvas-subtle border border-border px-2 py-1 rounded text-text-primary font-mono text-xs focus:outline-none focus:border-accent"
                >
                  {[1, 3, 5, 7, 10]
                    .filter((n) => n <= Math.max(pool.candidateChunks.length, 1))
                    .map((n) => (
                      <option key={n} value={n}>
                        Top-{n}
                      </option>
                    ))}
                </select>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => onRunRerank(topN)}
                disabled={isReranking}
                isLoading={isReranking}
                className="gap-1.5 font-mono text-xs shadow-sm"
              >
                {hasReranked ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Re-score Pool</span>
                  </>
                ) : (
                  <>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span>Run Cross-Encoder (Path A)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4 Action Bar: Laya Relevance Filtering Trigger */}
        {onRunLayaFilter && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface-elevated/70 rounded-md border border-emerald-500/30 text-xs">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold text-text-primary">
                  Path B Evaluation: Laya Relevance Filtering
                </span>
                <span className="text-text-muted ml-1.5 hidden sm:inline">
                  (Non-Autoregressive System 1 Gating)
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => onRunLayaFilter()}
              disabled={isFilteringLaya}
              isLoading={isFilteringLaya}
              className="gap-1.5 font-mono text-xs shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {hasLayaFiltered ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Re-filter with Laya</span>
                </>
              ) : (
                <>
                  <Filter className="h-3.5 w-3.5" />
                  <span>Run Laya Filter (Path B)</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
          <span className="text-[11px] text-text-muted font-mono truncate max-w-[420px]">
            Query: &ldquo;{pool.query}&rdquo;
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-[11px] text-text-muted hover:text-text-primary font-mono underline"
            >
              Expand All
            </button>
            <span className="text-text-muted">•</span>
            <button
              onClick={collapseAll}
              className="text-[11px] text-text-muted hover:text-text-primary font-mono underline"
            >
              Collapse All
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Candidate Chunks List */}
      <CardContent className="p-4 space-y-2.5 max-h-[580px] overflow-y-auto">
        {pool.candidateChunks.map((chunk) => {
          const isExpanded = expandedChunkIds.has(chunk.id);

          return (
            <div
              key={chunk.id}
              className="p-3 rounded border border-border/90 bg-surface-elevated/40 hover:border-border-strong transition-colors text-xs space-y-2"
            >
              {/* Chunk Top Line */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-accent">
                    #{chunk.rank}
                  </span>
                  <span className="text-text-muted">•</span>
                  <span className="font-semibold text-text-primary truncate max-w-[200px] sm:max-w-[280px]">
                    {chunk.source || chunk.documentId}
                  </span>
                  {chunk.pageNumber !== undefined && (
                    <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                      Page {chunk.pageNumber}
                    </Badge>
                  )}
                  <span className="text-[10px] font-mono text-text-muted truncate max-w-[150px]">
                    ID: {chunk.id}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary">
                    Cosine Sim:{" "}
                    <strong className="text-emerald-400">
                      {formatScore(chunk.retrievalScore, 4)}
                    </strong>
                  </span>
                  <Badge variant="muted" size="sm" className="text-[10px]">
                    Pending Eval
                  </Badge>
                </div>
              </div>

              {/* Chunk Text Body */}
              <div
                className={`font-mono text-[11px] text-text-secondary leading-relaxed bg-canvas-subtle/60 p-2.5 rounded border border-border/30 whitespace-pre-wrap ${
                  !isExpanded ? "line-clamp-3" : ""
                }`}
              >
                {chunk.text}
              </div>

              {/* Expand / Collapse Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => toggleExpand(chunk.id)}
                  className="text-[10px] font-mono text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <span>Collapse</span>
                      <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      <span>Expand full chunk ({chunk.text.length} chars)</span>
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
