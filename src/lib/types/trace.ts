/**
 * Discrete lifecycle phases in a RAG execution pipeline
 */
export type TracePhase =
  | "query_received"
  | "retrieval_started"
  | "chunks_retrieved"
  | "relevance_evaluation_started"
  | "relevance_evaluation_completed"
  | "chunks_filtered"
  | "context_built"
  | "generation_started"
  | "generation_completed"
  | "metrics_calculated";

export type TraceEventStatus = "pending" | "running" | "success" | "warning" | "error";

/**
 * Discrete decision trace event recorded by the Observer pattern
 * during pipeline execution for inspection and debugging.
 */
export interface TraceEvent {
  /** Unique event identifier */
  id: string;

  /** Epoch millisecond timestamp when event occurred */
  timestamp: number;

  /** Associated pipeline identifier */
  pipelineId: "advanced-rag" | "laya-rag";

  /** Lifecycle phase of the event */
  phase: TracePhase;

  /** Human-readable event description */
  label: string;

  /** Execution status of the step */
  status: TraceEventStatus;

  /** Elapsed duration of this phase in milliseconds, if applicable */
  durationMs?: number;

  /** Structured details / payload for debugging */
  details?: Record<string, unknown>;

  /** Optional error message if the phase failed */
  errorMessage?: string;
}
