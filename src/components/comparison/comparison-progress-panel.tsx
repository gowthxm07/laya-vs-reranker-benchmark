"use client";

import * as React from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { formatElapsedSeconds } from "@/lib/utils/formatters";

export type StageId =
  | "retrieval"
  | "cross-encoder-eval"
  | "laya-eval"
  | "context-prep"
  | "cross-encoder-gen"
  | "laya-gen"
  | "finalizing"
  | string;

export type StageStatus = "pending" | "running" | "completed" | "error";

export interface PipelineStageInfo {
  id: StageId;
  label: string;
  status: StageStatus;
  detail?: string;
  errorMessage?: string;
}

export interface ComparisonProgressPanelProps {
  stages: PipelineStageInfo[];
  elapsedSeconds: number;
  title?: string;
  badge?: string;
}

export function ComparisonProgressPanel({
  stages,
  elapsedSeconds,
  title,
  badge,
}: ComparisonProgressPanelProps) {
  const formattedTime = formatElapsedSeconds(elapsedSeconds);
  const isAllCompleted =
    stages.length > 0 && stages.every((s) => s.status === "completed");
  const hasError = stages.some((s) => s.status === "error");

  return (
    <div
      role="status"
      aria-live="polite"
      className="border border-border rounded-lg p-5 bg-white space-y-4 animate-in fade-in duration-150"
    >
      {/* Header with live elapsed timer */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          {hasError ? (
            <AlertCircle className="h-4 w-4 text-status-error shrink-0" />
          ) : isAllCompleted ? (
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
          )}
          <div className="text-xs font-semibold text-text-primary">
            {hasError
              ? "Comparison encountered an error"
              : isAllCompleted
              ? "Comparison completed"
              : title || "Comparison in progress"}
            <span className="text-text-muted font-normal mx-1.5">·</span>
            <span className="font-mono font-medium text-text-secondary">
              {formattedTime} {isAllCompleted ? "total" : "elapsed"}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-text-muted">
          {badge || "Same-LLM Benchmark"}
        </span>
      </div>

      {/* Discrete Pipeline Stages List */}
      <ol className="space-y-2.5">
        {stages.map((stage, idx) => {
          const isRunning = stage.status === "running";
          const isCompleted = stage.status === "completed";
          const isError = stage.status === "error";
          const isPending = stage.status === "pending";

          return (
            <li key={stage.id} className="text-xs">
              <div className="flex items-center gap-2.5">
                {/* State Icon */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {isCompleted && (
                    <Check
                      className="h-3.5 w-3.5 text-emerald-600"
                      aria-label="Completed"
                    />
                  )}
                  {isRunning && (
                    <Loader2
                      className="h-3.5 w-3.5 text-accent animate-spin"
                      aria-label="In progress"
                    />
                  )}
                  {isError && (
                    <AlertCircle
                      className="h-3.5 w-3.5 text-status-error"
                      aria-label="Failed"
                    />
                  )}
                  {isPending && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-border-dark inline-block"
                      aria-label="Pending"
                    />
                  )}
                </div>

                {/* Stage Index and Label */}
                <div className="flex-1 flex items-center justify-between">
                  <span
                    className={`font-medium ${
                      isRunning
                        ? "text-text-primary"
                        : isCompleted
                        ? "text-text-secondary"
                        : isError
                        ? "text-status-error"
                        : "text-text-muted"
                    }`}
                  >
                    <span className="font-mono text-[11px] mr-1.5 opacity-60">
                      0{idx + 1}.
                    </span>
                    {stage.label}
                  </span>

                  {/* Accessible status tag */}
                  <span className="text-[10px] font-mono shrink-0 ml-2">
                    {isCompleted && (
                      <span className="text-emerald-700">✓ Complete</span>
                    )}
                    {isRunning && (
                      <span className="text-accent">● Active</span>
                    )}
                    {isError && (
                      <span className="text-status-error">✕ Error</span>
                    )}
                    {isPending && (
                      <span className="text-text-muted opacity-50">Pending</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Special CPU notice during Laya evaluation */}
              {stage.id === "laya-eval" && isRunning && (
                <div className="mt-1.5 ml-6.5 pl-3 py-1.5 border-l-2 border-accent/40 bg-accent-subtle/30 rounded-r text-[11px] text-text-secondary">
                  Laya is evaluating candidate passages. This step can take longer on CPU.
                </div>
              )}

              {/* Stage error display */}
              {isError && stage.errorMessage && (
                <div className="mt-1 ml-6.5 pl-3 py-1 border-l-2 border-status-error/40 text-[11px] font-mono text-status-error">
                  {stage.errorMessage}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
