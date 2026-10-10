import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import {
  CrossEncoderProvider,
  CrossEncoderPredictionResult,
} from "../interfaces/cross-encoder-provider";

export interface PythonCrossEncoderConfig {
  model?: string;
  workerScriptPath?: string;
  pythonExecutable?: string;
  timeoutMs?: number;
}

/**
 * [PYTHON LOCAL CROSS-ENCODER PROVIDER]
 * Communicates with local sentence-transformers CrossEncoder via persistent worker process.
 * Eliminates per-query cold-start Python startup overhead by keeping model in memory.
 */
export class PythonCrossEncoderProvider implements CrossEncoderProvider {
  readonly id = "python";
  readonly model: string;
  private workerScriptPath: string;
  private pythonExecutable: string;
  private timeoutMs: number;

  private workerProcess: ChildProcess | null = null;
  private isReady: boolean = false;
  private readyPromise: Promise<void> | null = null;
  private modelLoadLatencyMs: number = 0;
  private hasReportedColdStart: boolean = false;

  private pendingRequests: Map<
    string,
    {
      resolve: (value: CrossEncoderPredictionResult) => void;
      reject: (reason: Error) => void;
      timer: NodeJS.Timeout;
    }
  > = new Map();

  private lineBuffer: string = "";

  constructor(config?: PythonCrossEncoderConfig) {
    this.model =
      config?.model ||
      process.env.CROSS_ENCODER_MODEL ||
      "cross-encoder/ms-marco-MiniLM-L-6-v2";
    this.workerScriptPath =
      config?.workerScriptPath ||
      path.join(process.cwd(), "scripts", "cross_encoder_worker.py");
    this.pythonExecutable = config?.pythonExecutable || "python";
    this.timeoutMs = config?.timeoutMs || 45000;
  }

  /**
   * Ensures the persistent Python worker is initialized and model is loaded
   */
  public async ensureWorker(): Promise<void> {
    if (this.isReady && this.workerProcess) {
      return;
    }
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const startLoadTime = performance.now();
      try {
        const proc = spawn(
          this.pythonExecutable,
          [this.workerScriptPath, this.model],
          {
            env: {
              ...process.env,
              PYTHONUNBUFFERED: "1",
              TOKENIZERS_PARALLELISM: "false",
              KMP_DUPLICATE_LIB_OK: "TRUE",
              OMP_NUM_THREADS: "4",
            },
          }
        );
        this.workerProcess = proc;

        const initTimer = setTimeout(() => {
          this.dispose();
          reject(
            new Error(
              `Cross-Encoder worker initialization timed out after ${this.timeoutMs}ms for model "${this.model}".`
            )
          );
        }, this.timeoutMs);

        proc.stdout.on("data", (data: Buffer) => {
          this.handleStdout(data);
          if (!this.isReady) {
            clearTimeout(initTimer);
            this.isReady = true;
            this.modelLoadLatencyMs =
              this.modelLoadLatencyMs || performance.now() - startLoadTime;
            resolve();
          }
        });

        proc.stderr.on("data", (data: Buffer) => {
          // Log informational PyTorch/HuggingFace messages without failing
          const str = data.toString();
          if (str.toLowerCase().includes("traceback") || str.toLowerCase().includes("error:")) {
            console.error("[CrossEncoder stderr]", str);
          }
        });

        proc.on("error", (err) => {
          clearTimeout(initTimer);
          this.isReady = false;
          this.readyPromise = null;
          reject(
            new Error(
              `Failed to spawn Python cross-encoder worker: ${err.message}`
            )
          );
        });

        proc.on("exit", (code) => {
          this.isReady = false;
          this.workerProcess = null;
          this.readyPromise = null;
          if (code !== 0 && code !== null) {
            console.error(`Cross-Encoder worker exited unexpectedly with code ${code}`);
          }
        });
      } catch (err) {
        this.readyPromise = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return this.readyPromise;
  }

  /**
   * Handles line-delimited JSON messages received from Python worker
   */
  private handleStdout(chunk: Buffer): void {
    this.lineBuffer += chunk.toString("utf-8");
    const lines = this.lineBuffer.split("\n");
    // Keep incomplete trailing fragment in buffer
    this.lineBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed);

        // Status announcement on model load
        if (message.status === "ready") {
          this.modelLoadLatencyMs =
            message.modelLoadLatencyMs || this.modelLoadLatencyMs;
          continue;
        }

        // Response to a pending prediction request
        if (message.id && this.pendingRequests.has(message.id)) {
          const pending = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          clearTimeout(pending.timer);

          if (message.error) {
            pending.reject(new Error(message.error));
          } else {
            const isCold = !this.hasReportedColdStart;
            this.hasReportedColdStart = true;

            pending.resolve({
              scores: message.scores || [],
              evaluationLatencyMs: message.evaluationLatencyMs || 0,
              modelLoadLatencyMs: this.modelLoadLatencyMs,
              isColdStart: isCold,
            });
          }
        }
      } catch {
        // Skip non-JSON informational lines
      }
    }
  }

  async predictScores(
    query: string,
    candidateTexts: string[]
  ): Promise<CrossEncoderPredictionResult> {
    if (!query.trim()) {
      throw new Error("Query cannot be empty for cross-encoder reranking.");
    }
    if (!candidateTexts || candidateTexts.length === 0) {
      return {
        scores: [],
        evaluationLatencyMs: 0,
        modelLoadLatencyMs: this.modelLoadLatencyMs,
        isColdStart: false,
      };
    }

    await this.ensureWorker();

    const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<CrossEncoderPredictionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(
          new Error(
            `Cross-Encoder batch prediction timed out after ${this.timeoutMs}ms.`
          )
        );
      }, this.timeoutMs);

      this.pendingRequests.set(reqId, { resolve, reject, timer });

      const payload = JSON.stringify({
        id: reqId,
        query,
        documents: candidateTexts,
      });

      try {
        this.workerProcess?.stdin?.write(payload + "\n");
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(reqId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    try {
      await this.ensureWorker();
      return {
        isAvailable: true,
        message: `Python CrossEncoder worker ready with model "${this.model}"`,
      };
    } catch (err) {
      return {
        isAvailable: false,
        message: `CrossEncoder unavailable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  public dispose(): void {
    if (this.workerProcess) {
      try {
        this.workerProcess.kill();
      } catch {}
      this.workerProcess = null;
      this.isReady = false;
      this.readyPromise = null;
    }
  }
}
