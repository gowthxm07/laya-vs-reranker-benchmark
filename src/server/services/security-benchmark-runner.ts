import * as fs from "fs";
import * as path from "path";
import {
  SecurityBenchmarkCase,
  SecurityBenchmarkRunResult,
  PathBenchmarkCaseResult,
  SecurityRunSummaryItem,
} from "@/lib/types/security-benchmark";
import { EmbeddingProvider } from "@/lib/interfaces/embedding-provider";
import { SecurityExperimentOrchestrator } from "./security-experiment-orchestrator";
import { SecurityBenchmarkEvaluator } from "./security-benchmark-evaluator";
import { SharedRetrieverService } from "./retriever-service";
import { getGlobalVectorStore } from "@/lib/vector-store/local-vector-store";
import { DocumentIngestionService } from "./ingestion-service";

export interface SecurityBenchmarkRunnerOptions {
  isSmokeTest?: boolean;
  caseIds?: string[];
  limit?: number;
  layaThreshold?: number;
  onProgress?: (completed: number, total: number, currentCaseId: string) => void;
  orchestrator?: SecurityExperimentOrchestrator;
  retriever?: SharedRetrieverService;
  embeddingProvider?: EmbeddingProvider;
}

export class SecurityBenchmarkRunnerService {
  private orchestrator: SecurityExperimentOrchestrator;
  private static datasetPath = path.resolve(
    process.cwd(),
    "data/benchmark/security-benchmark-queries.json"
  );
  private static resultsDir = path.resolve(
    process.cwd(),
    "data/benchmark/security-results"
  );

  constructor(orchestrator?: SecurityExperimentOrchestrator) {
    this.orchestrator = orchestrator || new SecurityExperimentOrchestrator();
  }

  /**
   * Loads and validates the separate security benchmark dataset.
   */
  public static loadDataset(): SecurityBenchmarkCase[] {
    if (!fs.existsSync(this.datasetPath)) {
      throw new Error(
        `Security benchmark dataset not found at: ${this.datasetPath}. Ensure security-benchmark-queries.json exists.`
      );
    }

    const raw = fs.readFileSync(this.datasetPath, "utf-8");
    const parsed = JSON.parse(raw) as SecurityBenchmarkCase[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Security benchmark dataset must be a non-empty array of test cases.");
    }

    const seenIds = new Set<string>();
    for (const c of parsed) {
      if (!c.id || typeof c.id !== "string") {
        throw new Error("Security benchmark case missing valid id.");
      }
      if (seenIds.has(c.id)) {
        throw new Error(`Duplicate security benchmark case id detected: ${c.id}`);
      }
      seenIds.add(c.id);

      if (!c.query || !c.query.trim()) {
        throw new Error(`Case ${c.id} has empty query.`);
      }
      if (!c.category) {
        throw new Error(`Case ${c.id} missing category.`);
      }
      if (typeof c.isPermitted !== "boolean") {
        throw new Error(`Case ${c.id} isPermitted must be a boolean.`);
      }
    }

    return parsed;
  }

  /**
   * Confirms that demo_document_security.pdf is indexed in the vector store.
   * If missing from vector store but present on disk, automatically indexes it.
   * If missing from disk entirely, throws an explicit configuration error.
   */
  public static async ensureSecurityDocument(
    embeddingProvider?: EmbeddingProvider
  ): Promise<{ documentId: string; filename: string }> {
    const vectorStore = getGlobalVectorStore();
    const summaries = await vectorStore.getIndexedDocumentsSummary();

    const existingSec = summaries.find(
      (d) => d.filename.includes("security") || d.documentId.includes("security")
    );

    if (existingSec && existingSec.chunkCount > 0) {
      return { documentId: existingSec.documentId, filename: existingSec.filename };
    }

    // Verify PDF existence on disk
    const pdfPath = path.resolve(process.cwd(), "demo_document_security.pdf");
    if (!fs.existsSync(pdfPath)) {
      throw new Error(
        "Setup Error: demo_document_security.pdf is missing from workspace root. Please generate or place the synthetic security PDF before running the benchmark."
      );
    }

    const buffer = fs.readFileSync(pdfPath);
    const ingestionService = new DocumentIngestionService(vectorStore, embeddingProvider);
    const result = await ingestionService.ingestDocument(
      buffer,
      "demo_document_security.pdf",
      "application/pdf"
    );

    return { documentId: result.document.id, filename: result.document.filename };
  }

  /**
   * Executes the security benchmark suite across all or a selected subset of test cases.
   */
  public async runBenchmark(
    options?: SecurityBenchmarkRunnerOptions
  ): Promise<SecurityBenchmarkRunResult> {
    const startTime = performance.now();
    const isSmokeTest = Boolean(options?.isSmokeTest);
    const layaThreshold = options?.layaThreshold ?? 0.75;

    // 1. Ensure security document is ready in the vector store
    const { documentId, filename: documentFilename } =
      await SecurityBenchmarkRunnerService.ensureSecurityDocument(options?.embeddingProvider);

    // 2. Load dataset
    let cases = SecurityBenchmarkRunnerService.loadDataset();

    if (options?.caseIds && options.caseIds.length > 0) {
      const idSet = new Set(options.caseIds);
      cases = cases.filter((c) => idSet.has(c.id));
    } else if (isSmokeTest) {
      // Curated diverse smoke test (6 cases covering diverse categories)
      const smokeIds = new Set([
        "SEC-BENCH-01", // Benign Public
        "SEC-BENCH-05", // Unauthorized Confidential Refusal
        "SEC-BENCH-09", // Unauthorized Restricted Refusal
        "SEC-BENCH-12", // Canary Extraction
        "SEC-BENCH-16", // Prompt Injection
        "SEC-BENCH-25", // Authorized Access
      ]);
      cases = cases.filter((c) => smokeIds.has(c.id));
    }

    if (options?.limit && options.limit > 0) {
      cases = cases.slice(0, options.limit);
    }

    if (cases.length === 0) {
      throw new Error("No benchmark cases found matching execution criteria.");
    }

    const vectorStore = getGlobalVectorStore();
    const retriever =
      options?.retriever ||
      new SharedRetrieverService(vectorStore, options?.embeddingProvider);

    const caseResults: Array<{
      caseItem: SecurityBenchmarkCase;
      pathA: PathBenchmarkCaseResult;
      pathB: PathBenchmarkCaseResult;
    }> = [];

    let completedCount = 0;
    let errorCount = 0;

    // 3. Sequentially execute each test case through live orchestrator
    for (let i = 0; i < cases.length; i++) {
      const caseItem = cases[i];
      if (options?.onProgress) {
        options.onProgress(i, cases.length, caseItem.id);
      }

      try {
        // Retrieve candidate pool from real indexed document
        const candidatePool = await retriever.retrieve(caseItem.query, {
          topK: 10,
          documentId,
        });

        // Execute live comparison through identical orchestrator
        const liveResult = await this.orchestrator.executeLiveComparison({
          query: caseItem.query,
          candidatePool: candidatePool.candidateChunks,
          simulatedRole: caseItem.simulatedRole,
          topN: 5,
          layaThreshold,
          documentId,
          documentName: documentFilename,
        });

        // Evaluate Path A
        const pathAEval = SecurityBenchmarkEvaluator.evaluateCase({
          caseItem,
          generatedAnswer: liveResult.pathA.generatedAnswer,
          rawContextText: liveResult.pathA.rawContextText,
          includedChunks: liveResult.pathA.includedInContext,
        });

        const pathAResultItem: PathBenchmarkCaseResult = {
          engine: "cross-encoder",
          guardrailType: "conventional",
          caseId: caseItem.id,
          query: caseItem.query,
          simulatedRole: caseItem.simulatedRole,
          isPermitted: caseItem.isPermitted,
          generatedAnswer: liveResult.pathA.generatedAnswer,
          rawContextText: liveResult.pathA.rawContextText,
          retrievedChunkIds: liveResult.pathA.retrievedCandidates.map((c) => c.id),
          retainedChunkIds: liveResult.pathA.retainedByRelevance.map((c) => c.id),
          discardedChunkIds: liveResult.pathA.discardedByRelevance.map((c) => c.id),
          blockedChunkIds: liveResult.pathA.blockedByAuthorization.map((c) => c.id),
          includedChunkIds: liveResult.pathA.includedInContext.map((c) => c.id),
          evaluation: pathAEval,
          promptTokens: liveResult.pathA.promptTokens,
          completionTokens: liveResult.pathA.completionTokens,
          relevanceLatencyMs: liveResult.pathA.relevanceLatencyMs,
          generationLatencyMs: liveResult.pathA.generationLatencyMs,
          totalLatencyMs: liveResult.pathA.totalLatencyMs,
          status: liveResult.pathA.executionStatus === "completed" ? "completed" : "error",
          errorMessage: liveResult.pathA.errorMessage,
        };

        // Evaluate Path B
        const pathBEval = SecurityBenchmarkEvaluator.evaluateCase({
          caseItem,
          generatedAnswer: liveResult.pathB.generatedAnswer,
          rawContextText: liveResult.pathB.rawContextText,
          includedChunks: liveResult.pathB.includedInContext,
        });

        const pathBResultItem: PathBenchmarkCaseResult = {
          engine: "laya",
          guardrailType: "instructions-only",
          caseId: caseItem.id,
          query: caseItem.query,
          simulatedRole: caseItem.simulatedRole,
          isPermitted: caseItem.isPermitted,
          generatedAnswer: liveResult.pathB.generatedAnswer,
          rawContextText: liveResult.pathB.rawContextText,
          retrievedChunkIds: liveResult.pathB.retrievedCandidates.map((c) => c.id),
          retainedChunkIds: liveResult.pathB.retainedByLaya.map((c) => c.id),
          discardedChunkIds: liveResult.pathB.discardedByLaya.map((c) => c.id),
          blockedChunkIds: [], // Path B has NO application-level authorization blockers!
          includedChunkIds: liveResult.pathB.includedInContext.map((c) => c.id),
          evaluation: pathBEval,
          promptTokens: liveResult.pathB.promptTokens,
          completionTokens: liveResult.pathB.completionTokens,
          relevanceLatencyMs: liveResult.pathB.relevanceLatencyMs,
          generationLatencyMs: liveResult.pathB.generationLatencyMs,
          totalLatencyMs: liveResult.pathB.totalLatencyMs,
          status: liveResult.pathB.executionStatus === "completed" ? "completed" : "error",
          errorMessage: liveResult.pathB.errorMessage,
        };

        caseResults.push({
          caseItem,
          pathA: pathAResultItem,
          pathB: pathBResultItem,
        });
        completedCount++;
      } catch (err: unknown) {
        errorCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Security benchmark failed on case ${caseItem.id}:`, errMsg);

        // Record infrastructure error without counting as safe refusal
        const fallbackEval = {
          isCanaryDisclosed: false,
          isSensitiveDisclosed: false,
          isContextExposed: false,
          isAppropriateRefusal: false,
          isBenignSuccess: false,
          isAuthorizedSuccess: false,
          isInjectionSucceeded: false,
          isPublicInfoLost: true,
          findings: [`EXECUTION_ERROR: ${errMsg}`],
          evaluationRationale: `Infrastructure error occurred during test execution: ${errMsg}`,
        };

        caseResults.push({
          caseItem,
          pathA: {
            engine: "cross-encoder",
            guardrailType: "conventional",
            caseId: caseItem.id,
            query: caseItem.query,
            simulatedRole: caseItem.simulatedRole,
            isPermitted: caseItem.isPermitted,
            generatedAnswer: `[Error: ${errMsg}]`,
            rawContextText: "",
            retrievedChunkIds: [],
            retainedChunkIds: [],
            discardedChunkIds: [],
            blockedChunkIds: [],
            includedChunkIds: [],
            evaluation: fallbackEval,
            promptTokens: 0,
            completionTokens: 0,
            relevanceLatencyMs: 0,
            generationLatencyMs: 0,
            totalLatencyMs: 0,
            status: "error",
            errorMessage: errMsg,
          },
          pathB: {
            engine: "laya",
            guardrailType: "instructions-only",
            caseId: caseItem.id,
            query: caseItem.query,
            simulatedRole: caseItem.simulatedRole,
            isPermitted: caseItem.isPermitted,
            generatedAnswer: `[Error: ${errMsg}]`,
            rawContextText: "",
            retrievedChunkIds: [],
            retainedChunkIds: [],
            discardedChunkIds: [],
            blockedChunkIds: [],
            includedChunkIds: [],
            evaluation: fallbackEval,
            promptTokens: 0,
            completionTokens: 0,
            relevanceLatencyMs: 0,
            generationLatencyMs: 0,
            totalLatencyMs: 0,
            status: "error",
            errorMessage: errMsg,
          },
        });
      }
    }

    if (options?.onProgress) {
      options.onProgress(cases.length, cases.length, "completed");
    }

    // 4. Compute aggregate metrics
    const pathAMetrics = SecurityBenchmarkEvaluator.computeAggregates(
      caseResults.map((r) => r.caseItem),
      caseResults.map((r) => r.pathA)
    );

    const pathBMetrics = SecurityBenchmarkEvaluator.computeAggregates(
      caseResults.map((r) => r.caseItem),
      caseResults.map((r) => r.pathB)
    );

    const durationMs = Math.round(performance.now() - startTime);
    const runId = `sec-run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const runResult: SecurityBenchmarkRunResult = {
      runId,
      timestamp: Date.now(),
      datasetVersion: "v1.0-synthetic-security",
      documentId,
      documentFilename,
      isSmokeTest,
      caseCount: cases.length,
      completedCount,
      errorCount,
      durationMs,
      pathAMetrics,
      pathBMetrics,
      caseResults,
    };

    // 5. Persist run result to separate namespace
    this.persistRunResult(runResult);

    return runResult;
  }

  /**
   * Persists run results into data/benchmark/security-results/
   */
  private persistRunResult(result: SecurityBenchmarkRunResult): void {
    try {
      if (!fs.existsSync(SecurityBenchmarkRunnerService.resultsDir)) {
        fs.mkdirSync(SecurityBenchmarkRunnerService.resultsDir, { recursive: true });
      }
      const filename = `security-benchmark-run-${result.timestamp}.json`;
      const filePath = path.join(SecurityBenchmarkRunnerService.resultsDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
      console.log(`Persisted security benchmark run to: ${filePath}`);
    } catch (err: unknown) {
      console.warn("Failed to persist security benchmark run:", err);
    }
  }

  /**
   * Lists historical security benchmark runs.
   */
  public static listHistoricalRuns(): SecurityRunSummaryItem[] {
    try {
      if (!fs.existsSync(this.resultsDir)) {
        return [];
      }

      const files = fs
        .readdirSync(this.resultsDir)
        .filter((f) => f.startsWith("security-benchmark-run-") && f.endsWith(".json"));

      const summaries: SecurityRunSummaryItem[] = [];
      for (const file of files) {
        try {
          const filePath = path.join(this.resultsDir, file);
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(raw) as SecurityBenchmarkRunResult;

          summaries.push({
            filename: file,
            runId: parsed.runId,
            timestamp: parsed.timestamp,
            documentFilename: parsed.documentFilename,
            isSmokeTest: parsed.isSmokeTest,
            caseCount: parsed.caseCount,
            completedCount: parsed.completedCount,
            errorCount: parsed.errorCount,
            durationMs: parsed.durationMs,
            pathACanaryDisclosure: parsed.pathAMetrics.canaryDisclosureRate.formatted,
            pathBCanaryDisclosure: parsed.pathBMetrics.canaryDisclosureRate.formatted,
            pathASensitiveDisclosure: parsed.pathAMetrics.unauthorizedSensitiveDisclosureRate.formatted,
            pathBSensitiveDisclosure: parsed.pathBMetrics.unauthorizedSensitiveDisclosureRate.formatted,
            pathABenignSuccess: parsed.pathAMetrics.benignAnswerSuccessRate.formatted,
            pathBBenignSuccess: parsed.pathBMetrics.benignAnswerSuccessRate.formatted,
          });
        } catch {
          continue;
        }
      }

      // Sort newest first
      return summaries.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  /**
   * Retrieves a single historical run by runId or filename.
   */
  public static getHistoricalRun(runIdOrFilename: string): SecurityBenchmarkRunResult | null {
    try {
      if (!fs.existsSync(this.resultsDir)) return null;

      const files = fs
        .readdirSync(this.resultsDir)
        .filter((f) => f.startsWith("security-benchmark-run-") && f.endsWith(".json"));

      for (const file of files) {
        if (file === runIdOrFilename) {
          const content = fs.readFileSync(path.join(this.resultsDir, file), "utf-8");
          return JSON.parse(content) as SecurityBenchmarkRunResult;
        }
        try {
          const content = fs.readFileSync(path.join(this.resultsDir, file), "utf-8");
          const parsed = JSON.parse(content) as SecurityBenchmarkRunResult;
          if (parsed.runId === runIdOrFilename) {
            return parsed;
          }
        } catch {
          continue;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}
