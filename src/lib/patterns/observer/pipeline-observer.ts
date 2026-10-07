import {
  IPipelineObserver,
  IObservablePipeline,
  PipelineNotification,
} from "../../interfaces/observer";
import { TraceEvent } from "../../types/trace";

/**
 * [OBSERVER PATTERN: SUBJECT IMPLEMENTATION]
 * Observable pipeline harness providing registration and dispatch of lifecycle events.
 */
export class ObservablePipelineSubject implements IObservablePipeline {
  private observers: Map<string, IPipelineObserver> = new Map();

  public addObserver(observer: IPipelineObserver): void {
    this.observers.set(observer.id, observer);
  }

  public removeObserver(observerId: string): void {
    this.observers.delete(observerId);
  }

  public notifyObservers(notification: PipelineNotification): void {
    this.observers.forEach((observer) => {
      try {
        observer.onEvent(notification);
      } catch (err) {
        console.error(`Error notifying observer ${observer.id}:`, err);
      }
    });
  }

  public getObserverCount(): number {
    return this.observers.size;
  }
}

/**
 * [OBSERVER PATTERN: CONCRETE OBSERVER]
 * Collects and accumulates TraceEvent entries during pipeline execution.
 */
export class TraceRecorderObserver implements IPipelineObserver {
  readonly id = "trace-recorder";
  private recordedEvents: TraceEvent[] = [];

  public onEvent(notification: PipelineNotification): void {
    this.recordedEvents.push(notification.event);
  }

  public getEvents(): TraceEvent[] {
    return [...this.recordedEvents];
  }

  public clear(): void {
    this.recordedEvents = [];
  }
}
