import * as React from "react";
import { Chunk } from "@/lib/types/chunk";
import { Badge } from "@/components/ui/badge";
import { formatScore } from "@/lib/utils/formatters";
import { CheckCircle2, XCircle, FileCode } from "lucide-react";

interface ChunkInspectorProps {
  chunks?: Chunk[];
  type: "retained" | "discarded";
  emptyMessage?: string;
}

export function ChunkInspector({
  chunks,
  type,
  emptyMessage,
}: ChunkInspectorProps) {
  if (!chunks || chunks.length === 0) {
    return (
      <div className="py-12 px-4 text-center border border-dashed border-border/70 rounded-md bg-canvas-subtle/40">
        <FileCode className="h-6 w-6 text-text-muted mx-auto mb-2 opacity-60" />
        <p className="text-xs font-medium text-text-secondary">
          {emptyMessage ||
            (type === "retained"
              ? "No retained chunks yet"
              : "No discarded chunks yet")}
        </p>
        <p className="text-[11px] text-text-muted max-w-sm mx-auto mt-1 leading-relaxed">
          {type === "retained"
            ? "Candidate chunks meeting the evaluator strategy's relevance threshold will be listed here with individual relevance scores."
            : "Candidate chunks determined to be noisy, redundant, or irrelevant will appear here for filtering auditability."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 max-h-[440px] overflow-y-auto pr-1">
      {chunks.map((chunk, index) => {
        const isRetained = chunk.decision === "retained";

        return (
          <div
            key={chunk.id || index}
            className="p-3 rounded border border-border/80 bg-surface-elevated/40 text-xs flex flex-col gap-2 hover:border-border-strong transition-colors"
          >
            {/* Header: Rank, Source, Scores & Decision Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-text-muted">
                  #{chunk.rank ?? index + 1}
                </span>
                <span className="font-medium text-text-primary truncate max-w-[160px] sm:max-w-[220px]">
                  {chunk.source || chunk.documentId}
                </span>
                {chunk.section && (
                  <span className="text-[10px] text-text-muted truncate max-w-[120px]">
                    § {chunk.section}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {chunk.relevanceScore !== undefined && (
                  <span className="font-mono text-[11px] text-text-secondary">
                    rel:{" "}
                    <strong className="text-text-primary">
                      {formatScore(chunk.relevanceScore)}
                    </strong>
                  </span>
                )}
                {isRetained ? (
                  <Badge variant="success" size="sm" className="gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Retained
                  </Badge>
                ) : (
                  <Badge variant="outline" size="sm" className="gap-1 text-rose-400 border-rose-900/60">
                    <XCircle className="h-2.5 w-2.5" /> Discarded
                  </Badge>
                )}
              </div>
            </div>

            {/* Passage Text */}
            <p className="text-[11px] text-text-secondary leading-relaxed font-mono line-clamp-4">
              {chunk.text}
            </p>

            {/* Optional Rationale */}
            {chunk.relevanceRationale && (
              <div className="text-[10px] text-text-muted italic bg-surface-subtle/60 p-1.5 rounded border border-border/30">
                Rationale: {chunk.relevanceRationale}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
