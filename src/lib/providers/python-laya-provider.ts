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

  /** Startup timeout in milliseconds (default: 60000ms for PyTorch cold load) */
  startupTimeoutMs?: number;

  /** Per-request evaluation timeout in milliseconds (default: 30000ms) */
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
  private pendingQueue: PendingRequest[] = [];
  private stdoutBuffer: string = "";
  private modelLoadLatencyMs: number = 0;
  private isFirstQuery: boolean = true;

  constructor(config?: PythonLayaProviderConfig) {
    const defaultModel =
      fs.existsSync("D:\\laya") ? "D:\\laya" : "convaiinnovations/laya";
    this.model = config?.modelPath || process.env.LAYA_MODEL_PATH || defaultModel;
    this.pythonPath =
      config?.pythonPath || process.env.PYTHON_PATH || "python";
    this.workerScriptPath =
      config?.workerScriptPath ||
      path.join(process.cwd(), "scripts", "laya_worker.py");
    this.startupTimeoutMs = config?.startupTimeoutMs ?? 60000;
    this.requestTimeoutMs = config?.requestTimeoutMs ?? 30000;
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

      const child = spawn(this.pythonPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      this.childProcess = child;
      let startupResolved = false;

      const timer = setTimeout(() => {
        if (!startupResolved) {
          startupResolved = true;
          this.dispose();
          reject(
            new Error(
              `Laya worker failed to start within ${this.startupTimeoutMs}ms.`
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
              return;
            }

            // Handle evaluation responses
            if (this.pendingQueue.length > 0) {
              const pending = this.pendingQueue.shift()!;
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
        if (!startupResolved) {
          startupResolved = true;
          clearTimeout(timer);
          reject(new Error(`Laya worker exited prematurely with code ${code}`));
        }
        this.flushPendingErrors(
          new Error(`Laya worker process exited with code ${code}`)
        );
      });
    });

    return this.initPromise;
  }

  private flushPendingErrors(err: Error): void {
    while (this.pendingQueue.length > 0) {
      const pending = this.pendingQueue.shift()!;
      clearTimeout(pending.timeoutId);
      pending.reject(err);
    }
  }

  async evaluateRelevance(
    query: string,
    candidates: LayaCandidatePayload[]
  ): Promise<LayaEvaluationResponse> {
    await this.ensureInitialized();

    if (!this.childProcess || !this.childProcess.stdin) {
      throw new Error("Laya child process is not available.");
    }

    return new Promise<LayaEvaluationResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const idx = this.pendingQueue.findIndex((p) => p.timeoutId === timeoutId);
        if (idx !== -1) {
          this.pendingQueue.splice(idx, 1);
          reject(
            new Error(
              `Laya evaluation timed out after ${this.requestTimeoutMs}ms.`
            )
          );
        }
      }, this.requestTimeoutMs);

      this.pendingQueue.push({ resolve, reject, timeoutId });

      if (!this.childProcess || !this.childProcess.stdin) {
        clearTimeout(timeoutId);
        const idx = this.pendingQueue.findIndex(
          (p) => p.timeoutId === timeoutId
        );
        if (idx !== -1) this.pendingQueue.splice(idx, 1);
        reject(new Error("Laya worker process or stdin is not available."));
        return;
      }

      const payload = JSON.stringify({
        action: "evaluate",
        query,
        candidates,
      });

      this.childProcess.stdin.write(payload + "\n", (err) => {
        if (err) {
          clearTimeout(timeoutId);
          const idx = this.pendingQueue.findIndex(
            (p) => p.timeoutId === timeoutId
          );
          if (idx !== -1) this.pendingQueue.splice(idx, 1);
          reject(new Error(`Failed to write to Laya worker: ${err.message}`));
        }
      });
    });
  }

  async checkHealth(): Promise<{ isAvailable: boolean; message?: string }> {
    try {
      await this.ensureInitialized();
      return {
        isAvailable: this.isReady,
        message: `Laya worker active (model: ${this.model})`,
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
        this.childProcess.kill("SIGTERM");
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
