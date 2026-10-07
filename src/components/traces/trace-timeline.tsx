import * as React from "react";
import { TraceEvent, TracePhase } from "@/lib/types/trace";
import { formatLatency } from "@/lib/utils/formatters";
import { Activity } from "lucide-react";

interface TraceTimelineProps {
  events?: TraceEvent[];
  pipelineLabel: string;
}

const LIFECYCLE_STEPS: Array<{ phase: TracePhase; label: string; desc: string }> = [
  { phase: "query_received", label: "Query Ingestion", desc: "Validate and vectorize user input query" },
  { phase: "retrieval_started", label: "Candidate Retrieval", desc: "Retrieve top candidate chunks from vector index" },
  { phase: "relevance_evaluation_started", label: "Relevance Strategy", desc: "Evaluate passage relevance via Strategy implementation" },
  { phase: "chunks_filtered", label: "Context Filtering", desc: "Prune low-relevance chunks and rank retained subset" },
  { phase: "context_built", label: "Prompt Synthesis", desc: "Assemble context window using ContextBuilder & PromptBuilder" },
  { phase: "generation_started", label: "LLM Generation", desc: "Generate grounded answer via configured LLMProvider" },
  { phase: "metrics_calculated", label: "Metrics Profiling", desc: "Calculate latency, token usage, and reduction rate" },
];

export function TraceTimeline({ events, pipelineLabel }: TraceTimelineProps) {
  const hasEvents = events && events.length > 0;

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center justify-between text-xs text-text-muted pb-1 border-b border-border/50">
        <span className="font-medium text-text-secondary flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-accent" />
          Execution Lifecycle Trace
        </span>
        <span className="font-mono text-[10px]">
          {hasEvents ? `${events.length} events logged` : "Pipeline unexecuted"}
        </span>
      </div>

      <div className="relative pl-5 border-l border-border/80 space-y-4 my-2">
        {LIFECYCLE_STEPS.map((step, idx) => {
          const matchingEvent = events?.find((e) => e.phase === step.phase);
          const isExecuted = Boolean(matchingEvent);
          const status = matchingEvent?.status || "pending";

          return (
            <div key={idx} className="relative group">
              {/* Dot marker */}
              <div
                className={`absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 bg-surface ${
                  isExecuted && status === "success"
                    ? "border-emerald-500 bg-emerald-500/20"
                    : isExecuted && status === "error"
                    ? "border-rose-500 bg-rose-500/20"
                    : "border-border text-text-muted"
                }`}
              />

              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-text-muted">
                    0{idx + 1}
                  </span>
                  <span className="text-xs font-medium text-text-primary">
                    {step.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {matchingEvent?.durationMs !== undefined ? (
                    <span className="font-mono text-[10px] text-text-secondary">
                      {formatLatency(matchingEvent.durationMs)}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-text-muted">
                      Not run
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>

      {!hasEvents && (
        <div className="text-[11px] text-text-muted bg-surface-subtle/50 p-2.5 rounded border border-border/50 text-center">
          Observer pattern trace will record real-time phase latencies and chunk retention decisions for {pipelineLabel} upon execution.
        </div>
      )}
    </div>
  );
}
