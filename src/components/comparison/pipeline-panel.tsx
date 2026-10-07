"use client";

import * as React from "react";
import { PipelineResult, PipelineId } from "@/lib/types/experiment";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ChunkInspector } from "./chunk-inspector";
import { TraceTimeline } from "@/components/traces/trace-timeline";
import {
  FileText,
  CheckCircle,
  XCircle,
  Activity,
  Sparkles,
} from "lucide-react";

interface PipelinePanelProps {
  pipelineId: PipelineId;
  title: string;
  strategyName: string;
  strategyDescription: string;
  patternRole: string;
  result?: PipelineResult;
}

type TabKey = "answer" | "retained" | "discarded" | "trace";

export function PipelinePanel({
  pipelineId,
  title,
  strategyName,
  strategyDescription,
  patternRole,
  result,
}: PipelinePanelProps) {
  const [activeTab, setActiveTab] = React.useState<TabKey>("answer");

  const status = result?.status || "idle";
  const retainedCount = result?.retainedChunks?.length;
  const discardedCount = result?.discardedChunks?.length;

  return (
    <Card data-pipeline={pipelineId} className="flex flex-col h-full bg-surface border border-border">
      {/* Panel Header */}
      <CardHeader className="p-4 bg-canvas-subtle/70 border-b border-border space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">
                {title}
              </span>
              <span className="text-text-muted">•</span>
              <Badge variant="outline" size="sm">
                {patternRole}
              </Badge>
            </div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight mt-0.5">
              {strategyName}
            </h2>
          </div>

          <StatusIndicator status={status} />
        </div>

        <p className="text-[11px] text-text-muted leading-relaxed">
          {strategyDescription}
        </p>

        {/* Quick Diagnostic Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono text-text-muted border-t border-border/40">
          <div>
            Retained:{" "}
            <strong className="text-text-secondary">
              {retainedCount !== undefined ? retainedCount : "—"}
            </strong>
          </div>
          <div>
            Eval:{" "}
            <strong className="text-text-secondary">
              {result?.relevanceEvaluationLatencyMs !== undefined
                ? `${Math.round(result.relevanceEvaluationLatencyMs)} ms`
                : "—"}
            </strong>
          </div>
          <div>
            LLM:{" "}
            <strong className="text-text-secondary">
              {result?.generationLatencyMs !== undefined
                ? `${Math.round(result.generationLatencyMs)} ms`
                : "—"}
            </strong>
          </div>
          <div>
            Total:{" "}
            <strong className="text-text-secondary">
              {result?.totalLatencyMs !== undefined
                ? `${Math.round(result.totalLatencyMs)} ms`
                : "—"}
            </strong>
          </div>
        </div>
      </CardHeader>

      {/* Internal Navigation Tabs */}
      <div className="flex items-center border-b border-border px-3 bg-surface text-xs font-medium">
        <button
          onClick={() => setActiveTab("answer")}
          className={`flex items-center gap-1.5 py-2.5 px-2.5 border-b-2 text-xs transition-colors ${
            activeTab === "answer"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Answer
        </button>

        <button
          onClick={() => setActiveTab("retained")}
          className={`flex items-center gap-1.5 py-2.5 px-2.5 border-b-2 text-xs transition-colors ${
            activeTab === "retained"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Retained Chunks
          {retainedCount !== undefined && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1 rounded">
              {retainedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("discarded")}
          className={`flex items-center gap-1.5 py-2.5 px-2.5 border-b-2 text-xs transition-colors ${
            activeTab === "discarded"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <XCircle className="h-3.5 w-3.5" />
          Discarded Chunks
          {discardedCount !== undefined && (
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/40 px-1 rounded">
              {discardedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("trace")}
          className={`flex items-center gap-1.5 py-2.5 px-2.5 border-b-2 text-xs transition-colors ${
            activeTab === "trace"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Trace
        </button>
      </div>

      {/* Tab Content Body */}
      <CardContent className="p-4 flex-1 flex flex-col justify-start">
        {activeTab === "answer" && (
          <div className="flex-1 flex flex-col space-y-3">
            {result?.answer ? (
              <>
                <div className="rounded border border-border/80 bg-surface-elevated/40 p-3.5 text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                  {result.answer}
                </div>

                {/* Token Usage & Context Inspection Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-canvas-subtle border border-border/60 text-[11px] font-mono text-text-muted">
                  <div className="flex items-center gap-2">
                    <span>
                      Prompt:{" "}
                      <strong className="text-text-secondary">
                        {result.inputTokens ?? "—"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Gen:{" "}
                      <strong className="text-text-secondary">
                        {result.outputTokens ?? "—"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Total:{" "}
                      <strong className="text-text-secondary">
                        {result.totalTokens ?? "—"}
                      </strong>
                    </span>
                  </div>

                  <button
                    onClick={() => setActiveTab("retained")}
                    className="text-accent hover:underline flex items-center gap-1"
                  >
                    View Retained Context ({retainedCount ?? 0})
                  </button>
                </div>
              </>
            ) : (
              <div className="py-14 text-center border border-dashed border-border/70 rounded-md bg-canvas-subtle/30 flex flex-col items-center justify-center">
                <FileText className="h-7 w-7 text-text-muted mb-2 opacity-60" />
                <h4 className="text-xs font-semibold text-text-secondary">
                  No generation output yet
                </h4>
                <p className="text-[11px] text-text-muted max-w-sm mt-1 leading-relaxed px-4">
                  Waiting for query execution. Once triggered, the selected context from{" "}
                  <span className="text-text-secondary font-medium">{strategyName}</span>{" "}
                  will be passed to the downstream LLM (llama3.2:3b) to generate the answer.
                </p>
                <div className="mt-3">
                  <Badge variant="muted" size="sm">
                    Status: Not run
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "retained" && (
          <ChunkInspector
            chunks={result?.retainedChunks}
            type="retained"
            emptyMessage={`No retained chunks for ${strategyName}`}
          />
        )}

        {activeTab === "discarded" && (
          <ChunkInspector
            chunks={result?.discardedChunks}
            type="discarded"
            emptyMessage={`No discarded chunks for ${strategyName}`}
          />
        )}

        {activeTab === "trace" && (
          <TraceTimeline
            events={result?.trace}
            pipelineLabel={strategyName}
          />
        )}
      </CardContent>
    </Card>
  );
}
