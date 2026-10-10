import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import {
  LayaProvider,
  LayaCandidatePayload,
  LayaEvaluationResponse,
} from "../interfaces/laya-provider";
import { LayaDecision } from "../types/laya";

export interface PythonLayaProviderConfig {
  /** Path to python executable (default: 'python' or process.env.PYTHON_PATH) */
  pythonPath?: string;

  /** Path or identifier of Laya checkpoint (default: 'D:\\laya' or process.env.LAYA_MODEL_PATH) */
  modelPath?: string;

  /** Path to laya_worker.py script */
  workerScriptPath?: string;

  /** Startup timeout in milliseconds (default: 120000ms for PyTorch cold load) */
  startupTimeoutMs?: number;

  /** Per-request evaluation timeout in milliseconds (default: 120000ms) */
  requestTimeoutMs?: number;
}

interface PendingRequest {
  resolve: (res: LayaEvaluationResponse) => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
}

/**
 * [PYTHON LAYA PROVIDER]
 * Manages a persistent Python child process executing laya.Agent via line-delimited JSON IPC.
 * Eliminates repeated ~25s PyTorch cold-start weight loads across requests.
 *
 * Hardened for Windows & PyTorch stability:
 * 1. Enforces single-worker serialization so stdin/stdout IPC never desynchronizes.
 * 2. Uses explicit request ID matching instead of fragile FIFO arrays.
 * 3. Never kills the worker on single query timeouts, avoiding STATUS_ACCESS_VIOLATION (0xC0000005).
 * 4. Limits CPU threads and disables Rayon tokenizer parallelism to prevent thread collisions.
 * 5. Automatically restarts the worker cleanly if the underlying process ever terminates.
 */
export class PythonLayaProvider implements LayaProvider {
  readonly id = "python";
  readonly model: string;
  private pythonPath: string;
  private workerScriptPath: string;
  private startupTimeoutMs: number;
  private requestTimeoutMs: number;

  private childProcess: ChildProcess | null = null;
  private isReady: boolean = false;
  private initPromise: Promise<void> | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestQueue: Promise<void> = Promise.resolve();
  private stdoutBuffer: string = "";
  private recentStderr: string = "";
  private modelLoadLatencyMs: number = 0;

  constructor(config?: PythonLayaProviderConfig) {
    const defaultModel =
      fs.existsSync("D:\\laya") ? "D:\\laya" : "convaiinnovations/laya";
    this.model = config?.modelPath || process.env.LAYA_MODEL_PATH || defaultModel;
    this.pythonPath =
      config?.pythonPath || process.env.PYTHON_PATH || "python";
    this.workerScriptPath =
      config?.workerScriptPath ||
      path.join(process.cwd(), "scripts", "laya_worker.py");
    this.startupTimeoutMs =
      config?.startupTimeoutMs ??
      (process.env.LAYA_STARTUP_TIMEOUT_MS
        ? Number(process.env.LAYA_STARTUP_TIMEOUT_MS)
        : 120000);
    this.requestTimeoutMs =
      config?.requestTimeoutMs ??
      (process.env.LAYA_REQUEST_TIMEOUT_MS
        ? Number(process.env.LAYA_REQUEST_TIMEOUT_MS)
        : 120000);
  }

  /**
   * Initializes and waits for the persistent python worker process to be ready.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isReady && this.childProcess && !this.childProcess.killed) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      const args = [this.workerScriptPath, "--model", this.model];

      // Windows stability: prevent OpenMP / Rust Rayon thread collisions and enforce unbuffered I/O
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        TOKENIZERS_PARALLELISM: "false",
        KMP_DUPLICATE_LIB_OK: "TRUE",
        OMP_NUM_THREADS: "4",
      };

      const child = spawn(this.pythonPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });

      this.childProcess = child;
      this.recentStderr = "";
      this.stdoutBuffer = "";
      let startupResolved = false;

      const timer = setTimeout(() => {
        if (!startupResolved) {
          startupResolved = true;
          this.dispose();
          reject(
            new Error(
              `Laya worker failed to start within ${this.startupTimeoutMs}ms for model "${this.model}".`
            )
          );
        }
      }, this.startupTimeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        this.stdoutBuffer += chunk.toString("utf-8");
        const lines = this.stdoutBuffer.split("\n");
        this.stdoutBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);

            // Handle worker ready notification on cold load
            if (data.status === "ready" && !startupResolved) {
              startupResolved = true;
              clearTimeout(timer);
              this.isReady = true;
              this.modelLoadLatencyMs = data.modelLoadLatencyMs || 0;
              resolve();
              continue; // Do not return early; process any subsequent lines
            }

            // Handle evaluation responses by request ID
            const reqId = data.id;
            let pending: PendingRequest | undefined;

            if (reqId && this.pendingRequests.has(reqId)) {
              pending = this.pendingRequests.get(reqId);
              this.pendingRequests.delete(reqId);
            } else if (!reqId && this.pendingRequests.size > 0) {
              // Fallback for responses without ID (e.g. legacy workers)
              const firstKey = this.pendingRequests.keys().next().value;
              if (firstKey) {
                pending = this.pendingRequests.get(firstKey);
                this.pendingRequests.delete(firstKey);
              }
            }

            if (pending) {
              clearTimeout(pending.timeoutId);

              if (data.success === false) {
                pending.reject(
                  new Error(data.error || "Laya evaluation failed.")
                );
              } else {
                const decisions: LayaDecision[] = data.decisions || [];
                pending.resolve({
                  decisions,
                  evaluationLatencyMs: data.evaluationLatencyMs ?? 0,
                  modelLoadLatencyMs: data.modelLoadLatencyMs ?? 0,
                  isColdStart: Boolean(data.isColdStart),
                  model: data.model || this.model,
                });
              }
            }
          } catch {
            // Ignore non-JSON lines (e.g. PyTorch / transformers runtime logs)
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        this.recentStderr = (this.recentStderr + text).slice(-4096);
        if (text.includes("Error:") || text.includes("Exception:")) {
          console.warn("[LayaWorker STDERR]:", text.trim());
        }
      });

      child.on("error", (err) => {
        if (!startupResolved) {
          startupResolved = true;
          clearTimeout(timer);
          reject(new Error(`Failed to spawn Laya worker: ${err.message}`));
        }
        this.flushPendingErrors(err);
      });

      child.on("exit", (code) => {
        this.isReady = false;
        this.childProcess = null;
        this.initPromise = null;
        const errDetail = this.recentStderr.trim()
          ? ` (stderr: ${this.recentStderr.trim().slice(-300)})`
          : "";
        const exitErr = new Error(
          `Laya worker process exited with code ${code}${errDetail}`
        );

        if (!startupResolved) {
          startupResolved = true;
          clearTimeout(timer);
          reject(
            new Error(
              `Laya worker exited prematurely with code ${code}${errDetail}`
            )
          );
        }
        this.flushPendingErrors(exitErr);
      });
    });

    return this.initPromise;
  }

  private flushPendingErrors(err: Error): void {
    const pendingList = Array.from(this.pendingRequests.values());
    this.pendingRequests.clear();
    for (const pending of pendingList) {
      clearTimeout(pending.timeoutId);
      pending.reject(err);
    }
  }

  /**
   * Evaluates relevance for candidate passages against the user query.
   * Serializes requests so concurrent callers never interleave lines on stdin.
   */
  async evaluateRelevance(
    query: string,
    candidates: LayaCandidatePayload[]
  ): Promise<LayaEvaluationResponse> {
    const reqId = `laya_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const executeEvaluation = async (): Promise<LayaEvaluationResponse> => {
      await this.ensureInitialized();

      if (!this.childProcess || !this.childProcess.stdin || this.childProcess.killed) {
        throw new Error("Laya child process is not available.");
      }

      return new Promise<LayaEvaluationResponse>((resolve, reject) => {
        // Request timeout only starts once this specific evaluation begins execution
        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(reqId);
          // Do NOT call this.dispose() on single request timeout!
          // Forcefully killing the worker causes 0xC0000005 access violations.
          reject(
            new Error(
              `Laya evaluation timed out after ${this.requestTimeoutMs}ms for query "${query.slice(0, 50)}...".`
            )
          );
        }, this.requestTimeoutMs);

        this.pendingRequests.set(reqId, { resolve, reject, timeoutId });

        const payload = JSON.stringify({
          id: reqId,
          action: "evaluate",
          query,
          candidates,
        });

        this.childProcess!.stdin!.write(payload + "\n", (err) => {
          if (err) {
            clearTimeout(timeoutId);
            this.pendingRequests.delete(reqId);
            reject(new Error(`Failed to write to Laya worker: ${err.message}`));
          }
        });
      });
    };

    // Serialize execution through a promise queue to guarantee single-writer IPC
    const executionPromise = this.requestQueue.then(
      () => executeEvaluation(),
      () => executeEvaluation()
    );

    // Keep the queue alive for subsequent callers regardless of outcome
    this.requestQueue = executionPromise.then(
      () => {},
      () => {}
    );

    return executionPromise;
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    try {
      await this.ensureInitialized();
      const isActive =
        this.isReady && !!this.childProcess && !this.childProcess.killed;
      return {
        isAvailable: isActive,
        message: isActive
          ? `Laya worker active (model: ${this.model})`
          : "Laya worker process is not ready",
      };
    } catch (err: unknown) {
      return {
        isAvailable: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  public dispose(): void {
    if (this.childProcess && !this.childProcess.killed) {
      try {
        this.childProcess.stdin?.end();
        this.childProcess.kill();
      } catch {
        // Process cleanup
      }
    }
    this.childProcess = null;
    this.isReady = false;
    this.initPromise = null;
    this.flushPendingErrors(new Error("Laya provider disposed."));
  }
}
