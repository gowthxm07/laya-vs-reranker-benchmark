import { TraceEvent } from "../types/trace";

/**
 * Union of pipeline events that observers can subscribe to
 */
export type PipelineEventType =
  | "phase:started"
  | "phase:completed"
  | "phase:failed"
  | "chunk:evaluated"
  | "metric:recorded";

export interface PipelineNotification {
  type: PipelineEventType;
  event: TraceEvent;
}

/**
 * [OBSERVER PATTERN CONTRACT]
 * Interface for components listening to pipeline execution lifecycle events
 * (e.g. LatencyProfiler, DecisionTraceRecorder, TelemetryLogger).
 */
export interface IPipelineObserver {
  /** Unique observer identifier */
  readonly id: string;

  /** Handler invoked when a pipeline event is emitted */
  onEvent(notification: PipelineNotification): void | Promise<void>;
}

/**
 * [OBSERVABLE SUBJECT CONTRACT]
 * Interface implemented by orchestrators or pipeline runners to manage observers.
 */
export interface IObservablePipeline {
  /** Subscribes an observer */
  addObserver(observer: IPipelineObserver): void;

  /** Unsubscribes an observer */
  removeObserver(observerId: string): void;

  /** Notifies all registered observers of an event */
  notifyObservers(notification: PipelineNotification): void;
}
