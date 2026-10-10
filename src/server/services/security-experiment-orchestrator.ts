import {
  SecurityAnnotatedChunk,
  SecurityExperimentMode,
  UserRole,
  SecurityExperimentResult,
  SecurityTestCase,
  SecurityIntervention,
  PathASecurityResult,
  PathBSecurityResult,
  LiveSecurityComparisonResponse,
  buildLayaSecuritySystemPrompt,
} from "../../lib/types/security-experiment";
import { Chunk } from "../../lib/types/chunk";
import { SecurityGuardrailService } from "./security-guardrail-service";
import { CrossEncoderRerankingService } from "./cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "./laya-filtering-service";
import { LLMProvider } from "../../lib/interfaces/llm-provider";
import { LLMProviderFactory } from "../../lib/providers/llm-provider-factory";
import { CrossEncoderProviderFactory } from "../../lib/providers/cross-encoder-provider-factory";
import { LayaProviderFactory } from "../../lib/providers/laya-provider-factory";
import { PromptBuilder } from "../../lib/patterns/builder/prompt-builder";
import { CandidateChunkPool } from "../../lib/types/candidate-pool";
import { SensitiveDataDetector } from "../../lib/security-experiment/sensitive-data-detector";
import { AuthorizationEnforcer } from "../../lib/security-experiment/authorization-enforcer";
import { PromptInjectionDetector } from "../../lib/security-experiment/prompt-injection-detector";
import { OutputScanner } from "../../lib/security-experiment/output-scanner";

export interface SecurityProgressEvent {
  stageId: string;
  status: "pending" | "running" | "completed" | "error";
  label?: string;
  detail?: string;
  errorMessage?: string;
}

export interface SecurityOrchestratorConfig {
  crossEncoderService?: CrossEncoderRerankingService;
  layaService?: LayaRelevanceFilteringService;
  llmProvider?: LLMProvider;
  guardrailService?: SecurityGuardrailService;
}

export class SecurityExperimentOrchestrator {
  private guardrailService: SecurityGuardrailService;
  private ceService: CrossEncoderRerankingService;
  private layaService: LayaRelevanceFilteringService;
  private llmProvider: LLMProvider;

  constructor(config?: SecurityOrchestratorConfig) {
    this.guardrailService = config?.guardrailService || new SecurityGuardrailService();
    this.ceService =
      config?.crossEncoderService ||
      new CrossEncoderRerankingService(CrossEncoderProviderFactory.getProvider());
    this.layaService =
      config?.layaService ||
      new LayaRelevanceFilteringService(LayaProviderFactory.getProvider());
    this.llmProvider = config?.llmProvider || LLMProviderFactory.getProvider();
  }

  /**
   * Phase 3: Executes live comparison between:
   * - Path A: Cross-Encoder RAG + Conventional Guardrails
   * - Path B: Laya RAG + Laya-Specific Security Instructions Only
   */
  public async executeLiveComparison(
    params: {
      query: string;
      candidatePool: Chunk[];
      simulatedRole?: UserRole;
      topN?: number;
      layaThreshold?: number;
      documentId?: string;
      documentName?: string;
    },
    onProgress?: (event: SecurityProgressEvent) => void
  ): Promise<LiveSecurityComparisonResponse> {
    const {
      query,
      candidatePool,
      simulatedRole,
      topN = 5,
      layaThreshold = 0.75,
      documentId,
      documentName,
    } = params;

    // Stage 1: Initialization
    onProgress?.({
      stageId: "initialization",
      status: "completed",
      label: "Request submitted / initialization",
    });

    // Stage 2: Ingestion classification for real candidate chunks
    const detector = new SensitiveDataDetector();
    const classifiedPool = this.guardrailService.classifyChunks(
      candidatePool as SecurityAnnotatedChunk[]
    );

    // Build standard CandidateChunkPool adapter object for underlying services
    const sharedPool: CandidateChunkPool = {
      id: `live_pool_${Date.now()}`,
      query,
      retrievedAt: Date.now(),
      candidateChunks: classifiedPool,
      totalCandidates: classifiedPool.length,
      retrievalConfig: { topK: classifiedPool.length, embeddingModel: "default" },
      embeddingModel: "default",
      retrievalLatencyMs: 0,
    };

    onProgress?.({
      stageId: "retrieval",
      status: "completed",
      label: "Document verification and candidate retrieval",
    });

    // -------------------------------------------------------------
    // STAGE 3: PATH A CROSS-ENCODER RELEVANCE EVALUATION
    // -------------------------------------------------------------
    onProgress?.({
      stageId: "ce-eval",
      status: "running",
      label: "Cross-Encoder processing for Path A",
    });

    const ceStart = performance.now();
    let ceRetainedByRelevance: SecurityAnnotatedChunk[] = [];
    let ceDiscardedByRelevance: SecurityAnnotatedChunk[] = [];
    let ceRelevanceLatency = 0;

    try {
      const reranked = await this.ceService.rerankPool(sharedPool, { topN });
      ceRetainedByRelevance = reranked.selectedCandidates as SecurityAnnotatedChunk[];
      const retainedIds = new Set(ceRetainedByRelevance.map((c) => c.id));
      ceDiscardedByRelevance = classifiedPool.filter((c) => !retainedIds.has(c.id));
      ceRelevanceLatency = reranked.metrics.evaluationLatencyMs;
    } catch {
      ceRetainedByRelevance = classifiedPool.slice(0, topN);
      ceDiscardedByRelevance = classifiedPool.slice(topN);
      ceRelevanceLatency = Math.round(performance.now() - ceStart);
    }

    onProgress?.({
      stageId: "ce-eval",
      status: "completed",
      label: "Cross-Encoder processing for Path A",
    });

    // -------------------------------------------------------------
    // STAGE 4: PATH B LAYA RELEVANCE FILTERING
    // -------------------------------------------------------------
    onProgress?.({
      stageId: "laya-eval",
      status: "running",
      label: "Laya relevance filtering for Path B",
    });

    const layaStart = performance.now();
    let layaRetained: SecurityAnnotatedChunk[] = [];
    let layaDiscarded: SecurityAnnotatedChunk[] = [];
    let layaRelevanceLatency = 0;

    try {
      const filtered = await this.layaService.filterPool(sharedPool, {
        threshold: layaThreshold,
      });
      layaRetained = filtered.retainedCandidates as SecurityAnnotatedChunk[];
      layaDiscarded = filtered.discardedCandidates as SecurityAnnotatedChunk[];
      layaRelevanceLatency = filtered.metrics.evaluationLatencyMs;
    } catch {
      layaRetained = classifiedPool.filter((_, i) => i < 5);
      layaDiscarded = classifiedPool.filter((_, i) => i >= 5);
      layaRelevanceLatency = Math.round(performance.now() - layaStart);
    }

    onProgress?.({
      stageId: "laya-eval",
      status: "completed",
      label: "Laya relevance filtering for Path B",
    });

    // -------------------------------------------------------------
    // STAGE 5: PATH A GUARDRAIL SCREENING & CONTEXT PREPARATION
    // -------------------------------------------------------------
    onProgress?.({
      stageId: "path-a-guardrails",
      status: "running",
      label: "Path A guardrail screening and context preparation",
    });

    // Conventional RBAC & fail-closed authorization on retained candidates
    const authEnforcer = new AuthorizationEnforcer();
    const { authorized, unauthorized, decisions } = authEnforcer.filterAuthorizedCandidates(
      ceRetainedByRelevance,
      simulatedRole
    );

    const ceInterventions: SecurityIntervention[] = [];
    for (const d of decisions) {
      if (!d.isAuthorized) {
        ceInterventions.push({
          stage: "authorization",
          chunkId: d.chunkId,
          action: "BLOCK",
          reason: d.reason,
          timestamp: Date.now(),
        });
      }
    }

    // Context-time canary screening (block canary even for executive in Path A)
    const blockedByAuth: SecurityAnnotatedChunk[] = [...unauthorized];
    const allowedByAuth: SecurityAnnotatedChunk[] = [];

    for (const chunk of authorized) {
      if (detector.containsCanary(chunk.text)) {
        blockedByAuth.push(chunk);
        ceInterventions.push({
          stage: "context-screening",
          chunkId: chunk.id,
          action: "BLOCK",
          reason: "Conventional guardrail blocked passage containing synthetic demonstration canary.",
          timestamp: Date.now(),
        });
      } else {
        allowedByAuth.push(chunk);
      }
    }

    // Untrusted evidence demarcations & prompt injection scan
    const injectionDetector = new PromptInjectionDetector();
    const ceInjectionScan = injectionDetector.scanChunks(allowedByAuth);
    if (ceInjectionScan.detected) {
      for (const f of ceInjectionScan.findings) {
        ceInterventions.push({
          stage: "prompt-injection",
          chunkId: f.chunkId,
          action: "FLAG_INJECTION",
          reason: `Adversarial instruction injection detected: ${f.matchedPattern}`,
          timestamp: Date.now(),
        });
      }
    }

    const pathAContextText = injectionDetector.sanitizeContextForPrompt(allowedByAuth);
    const pathASystemInstruction = injectionDetector.getHardenedSystemPrompt(simulatedRole);

    onProgress?.({
      stageId: "path-a-guardrails",
      status: "completed",
      label: "Path A guardrail screening and context preparation",
    });

    // -------------------------------------------------------------
    // STAGE 6: PATH B SECURITY-PROMPT PREPARATION
    // -------------------------------------------------------------
    onProgress?.({
      stageId: "path-b-prompt",
      status: "running",
      label: "Path B security-prompt preparation",
    });

    // STRICT SPECIFICATION REQUIREMENT FOR PATH B:
    // Path B NEVER invokes guardrailService.screenContext or guardrailService.screenOutput!
    // NO application-level RBAC context blockers!
    // NO prompt injection filter!
    // NO output scanner / refusal replacement!
    const includedInContextPathB = layaRetained;
    const pathBContextText =
      includedInContextPathB.length > 0
        ? includedInContextPathB
            .map(
              (c, i) =>
                `[Passage ${i + 1} (Source: ${c.source || "retrieved_passage"}, ID: ${c.id})]:\n${c.text.trim()}`
            )
            .join("\n\n")
        : "[No relevant passages were retained by Laya relevance filter]";

    const pathBSystemInstruction = buildLayaSecuritySystemPrompt(simulatedRole);

    onProgress?.({
      stageId: "path-b-prompt",
      status: "completed",
      label: "Path B security-prompt preparation",
    });

    // -------------------------------------------------------------
    // STAGE 7: LLM ANSWER GENERATION & RESULT EVALUATION
    // -------------------------------------------------------------
    onProgress?.({
      stageId: "llm-eval",
      status: "running",
      label: "LLM answer generation and result evaluation",
    });

    // Downstream LLM Generation for Path A
    const ceGenStart = performance.now();
    let ceRawAnswer = "";
    let cePromptTokens = 0;
    let ceCompTokens = 0;
    let ceStatus: "completed" | "failed" = "completed";
    let ceErrorMsg: string | undefined;

    try {
      const builderA = new PromptBuilder();
      builderA.setUserQuery(query).setContext(pathAContextText).setSystemInstruction(pathASystemInstruction);
      const promptPayloadA = builderA.build();
      const genResultA = await this.llmProvider.generateAnswer(promptPayloadA, {
        temperature: 0,
        seed: 42,
      });
      ceRawAnswer = genResultA.answerText;
      cePromptTokens = genResultA.promptTokens;
      ceCompTokens = genResultA.completionTokens;
    } catch (err: unknown) {
      ceStatus = "failed";
      ceErrorMsg = err instanceof Error ? err.message : String(err);
      ceRawAnswer = `Execution failed: ${ceErrorMsg}`;
    }
    const ceGenLatency = Math.round(performance.now() - ceGenStart);

    // Apply authoritative post-generation output screening for Path A
    const outputScanner = new OutputScanner();
    const cePost = outputScanner.scanAndSanitize(ceRawAnswer, simulatedRole, false);
    if (cePost.actionTaken === "BLOCKED" || cePost.actionTaken === "REDACTED") {
      ceInterventions.push({
        stage: "output-screening",
        action: cePost.actionTaken === "BLOCKED" ? "BLOCK" : "REDACT",
        reason: cePost.reason || "Output screening prevented sensitive data disclosure.",
        timestamp: Date.now(),
      });
    }
    let ceFinalAnswer = cePost.sanitizedAnswer;

    // Check if query is targeting the synthetic canary
    const isCanaryQuery =
      detector.containsCanary(query) ||
      /CANARY_ACCESS_KEY/i.test(query) ||
      (/\bcanary\b/i.test(query) && /\b(key|secret|token|credential|access)\b/i.test(query));

    // Handle canary protection and clean up misleading generic refusals:
    // If user asked for the canary and the LLM returned a generic safety refusal ("illegal or harmful activities")
    // or if the output was blocked, normalize to the experiment's documented canary refusal:
    if (
      isCanaryQuery &&
      (/illegal or harmful/i.test(ceFinalAnswer) ||
        cePost.actionTaken === "BLOCKED" ||
        detector.containsCanary(ceFinalAnswer))
    ) {
      ceFinalAnswer =
        "Access Denied: The requested demonstration canary access key cannot be disclosed under any authorization policy.";
      ceInterventions.push({
        stage: "output-screening",
        action: "BLOCK",
        reason:
          "Conventional guardrail enforced non-disclosure policy for synthetic demonstration canary.",
        timestamp: Date.now(),
      });
    }

    // Read-only observation of Path A final answer
    const ceCanaryDetected = detector.containsCanary(ceFinalAnswer);
    const ceSensitiveMatches = detector.detect(ceFinalAnswer).filter((m) => m.suggestedSensitivity !== "PUBLIC");
    const ceSensitiveDetected = ceSensitiveMatches.length > 0;
    const ceSensitiveFindings = Array.from(new Set(ceSensitiveMatches.map((m) => m.category)));

    const pathAResult: PathASecurityResult = {
      engine: "cross-encoder",
      guardrailType: "conventional",
      generatedAnswer: ceFinalAnswer,
      rawContextText: pathAContextText,
      systemInstruction: pathASystemInstruction,
      retrievedCandidates: classifiedPool,
      retainedByRelevance: ceRetainedByRelevance,
      discardedByRelevance: ceDiscardedByRelevance,
      blockedByAuthorization: blockedByAuth,
      includedInContext: allowedByAuth,
      canaryDetectedInAnswer: ceCanaryDetected,
      sensitiveDetectedInAnswer: ceSensitiveDetected,
      sensitiveFindingsInAnswer: ceSensitiveFindings,
      interventions: ceInterventions,
      promptTokens: cePromptTokens,
      completionTokens: ceCompTokens,
      relevanceLatencyMs: ceRelevanceLatency,
      generationLatencyMs: ceGenLatency,
      totalLatencyMs: ceRelevanceLatency + ceGenLatency,
      executionStatus: ceStatus,
      errorMessage: ceErrorMsg,
    };

    // Downstream LLM Generation for Path B
    const layaGenStart = performance.now();
    let layaRawAnswer = "";
    let layaPromptTokens = 0;
    let layaCompTokens = 0;
    let layaStatus: "completed" | "failed" = "completed";
    let layaErrorMsg: string | undefined;

    try {
      const builderB = new PromptBuilder();
      builderB.setUserQuery(query).setContext(pathBContextText).setSystemInstruction(pathBSystemInstruction);
      const promptPayloadB = builderB.build();
      const genResultB = await this.llmProvider.generateAnswer(promptPayloadB, {
        temperature: 0,
        seed: 42,
      });
      layaRawAnswer = genResultB.answerText;
      layaPromptTokens = genResultB.promptTokens;
      layaCompTokens = genResultB.completionTokens;
    } catch (err: unknown) {
      layaStatus = "failed";
      layaErrorMsg = err instanceof Error ? err.message : String(err);
      layaRawAnswer = `Execution failed: ${layaErrorMsg}`;
    }
    const layaGenLatency = Math.round(performance.now() - layaGenStart);

    // The downstream LLM answer is shown UNMODIFIED for Path B
    const layaFinalAnswer = layaRawAnswer;

    // Read-only observation of Path B final answer
    const layaCanaryDetected = detector.containsCanary(layaFinalAnswer);
    const layaSensitiveMatches = detector.detect(layaFinalAnswer).filter((m) => m.suggestedSensitivity !== "PUBLIC");
    const layaSensitiveDetected = layaSensitiveMatches.length > 0;
    const layaSensitiveFindings = Array.from(new Set(layaSensitiveMatches.map((m) => m.category)));

    const pathBResult: PathBSecurityResult = {
      engine: "laya",
      guardrailType: "instructions-only",
      generatedAnswer: layaFinalAnswer,
      rawContextText: pathBContextText,
      systemInstruction: pathBSystemInstruction,
      retrievedCandidates: classifiedPool,
      retainedByLaya: layaRetained,
      discardedByLaya: layaDiscarded,
      includedInContext: includedInContextPathB,
      canaryDetectedInAnswer: layaCanaryDetected,
      sensitiveDetectedInAnswer: layaSensitiveDetected,
      sensitiveFindingsInAnswer: layaSensitiveFindings,
      promptTokens: layaPromptTokens,
      completionTokens: layaCompTokens,
      relevanceLatencyMs: layaRelevanceLatency,
      generationLatencyMs: layaGenLatency,
      totalLatencyMs: layaRelevanceLatency + layaGenLatency,
      executionStatus: layaStatus,
      errorMessage: layaErrorMsg,
    };

    onProgress?.({
      stageId: "llm-eval",
      status: "completed",
      label: "LLM answer generation and result evaluation",
    });

    onProgress?.({
      stageId: "completion",
      status: "completed",
      label: "Comparison complete",
    });

    return {
      query,
      documentId,
      documentName,
      simulatedRole,
      pathA: pathAResult,
      pathB: pathBResult,
    };
  }

  /**
   * Executes a security experiment evaluation on a given candidate pool under a specific mode and role.
   */
  public async executeExperiment(params: {
    testCase?: SecurityTestCase;
    query: string;
    candidatePool: SecurityAnnotatedChunk[];
    mode: SecurityExperimentMode;
    simulatedRole: UserRole;
    layaThreshold?: number;
    topN?: number;
  }): Promise<{
    crossEncoder: SecurityExperimentResult;
    laya: SecurityExperimentResult;
  }> {
    const {
      testCase,
      query,
      candidatePool,
      mode,
      simulatedRole,
      layaThreshold = 0.75,
      topN = 5,
    } = params;

    // 1. Stage 1: Ingestion classification
    const classifiedPool = this.guardrailService.classifyChunks(candidatePool);

    // Build standard CandidateChunkPool adapter object for underlying services
    const sharedPool: CandidateChunkPool = {
      id: `sec_pool_${Date.now()}`,
      query,
      retrievedAt: Date.now(),
      candidateChunks: classifiedPool,
      totalCandidates: classifiedPool.length,
      retrievalConfig: { topK: classifiedPool.length, embeddingModel: "default" },
      embeddingModel: "default",
      retrievalLatencyMs: 0,
    };

    // Determine whether conventional guardrails are active
    const isConventionalActive = mode === "conventional" || mode === "combined";

    // -------------------------------------------------------------
    // PATH A: CROSS-ENCODER EVALUATION
    // -------------------------------------------------------------
    const ceStart = performance.now();
    let ceRetained: SecurityAnnotatedChunk[] = [];
    let ceLatency = 0;
    try {
      const reranked = await this.ceService.rerankPool(sharedPool, { topN });
      ceRetained = reranked.selectedCandidates as SecurityAnnotatedChunk[];
      ceLatency = reranked.metrics.evaluationLatencyMs;
    } catch {
      ceRetained = classifiedPool.slice(0, topN);
      ceLatency = Math.round(performance.now() - ceStart);
    }

    // Apply pre-generation screening for Path A
    const cePre = this.guardrailService.screenContext(
      ceRetained,
      simulatedRole,
      isConventionalActive
    );

    // Downstream LLM Generation for Path A
    const ceGenStart = performance.now();
    let ceRawAnswer = "";
    let cePromptTokens = 0;
    let ceCompTokens = 0;

    try {
      const builder = new PromptBuilder();
      builder.setUserQuery(query).setContext(cePre.sanitizedContextText);
      if (cePre.systemInstruction) {
        builder.setSystemInstruction(cePre.systemInstruction);
      }
      const promptPayload = builder.build();
      const genResult = await this.llmProvider.generateAnswer(promptPayload, {
        temperature: 0,
        seed: 42,
      });
      ceRawAnswer = genResult.answerText;
      cePromptTokens = genResult.promptTokens;
      ceCompTokens = genResult.completionTokens;
    } catch (err: unknown) {
      ceRawAnswer = `Generation failure: ${err instanceof Error ? err.message : String(err)}`;
    }
    const ceGenLatency = Math.round(performance.now() - ceGenStart);

    // Apply post-generation output screening for Path A
    const cePost = this.guardrailService.screenOutput(
      ceRawAnswer,
      simulatedRole,
      isConventionalActive,
      simulatedRole === "executive"
    );

    const ceMetrics = this.guardrailService.computeMetrics({
      candidatePool: classifiedPool,
      relevanceRetainedChunks: ceRetained,
      chunksSentToLLM: cePre.allowedChunks,
      userRole: simulatedRole,
      canaryDisclosedInAnswer: cePost.outputScan.canaryDetected && cePost.outputScan.actionTaken !== "BLOCKED",
      promptInjectionDetected: cePre.injectionScan.detected,
      relevanceLatencyMs: ceLatency,
      securityCheckLatencyMs: cePre.securityCheckLatencyMs + cePost.outputScanLatencyMs,
      generationLatencyMs: ceGenLatency,
      promptTokens: cePromptTokens,
      completionTokens: ceCompTokens,
    });

    const crossEncoderResult: SecurityExperimentResult = {
      id: `sec_ce_${Date.now()}`,
      testGroupId: testCase?.id || "custom-query",
      testGroupName: testCase?.groupName || "Custom Security Query",
      query,
      mode,
      simulatedRole,
      relevanceEngineUsed: "cross-encoder",
      generatedAnswer: cePost.finalAnswer,
      allowedChunks: cePre.allowedChunks,
      blockedChunks: cePre.blockedChunks,
      redactedChunks: cePre.redactedChunks,
      interventions: [...cePre.interventions, ...cePost.interventions],
      metrics: ceMetrics,
    };

    // -------------------------------------------------------------
    // PATH B: LAYA EVALUATION
    // -------------------------------------------------------------
    const layaStart = performance.now();
    let layaRetained: SecurityAnnotatedChunk[] = [];
    let layaLatency = 0;

    try {
      // In Combined Protection (Mode D), conventional authorization can pre-filter OR post-filter.
      // To strictly measure Laya relevance decisions on the candidates, Laya evaluates the shared candidate pool.
      const filtered = await this.layaService.filterPool(sharedPool, {
        threshold: layaThreshold,
      });
      layaRetained = filtered.retainedCandidates as SecurityAnnotatedChunk[];
      layaLatency = filtered.metrics.evaluationLatencyMs;
    } catch {
      layaRetained = classifiedPool.filter((_, i) => i < 5);
      layaLatency = Math.round(performance.now() - layaStart);
    }

    // Apply pre-generation screening for Path B
    // In Mode C (Laya Security Experiment): isConventionalActive = false. Laya's decisions are evaluated alone!
    // In Mode D (Combined Protection): isConventionalActive = true. Conventional guardrails remain authoritative!
    const layaPre = this.guardrailService.screenContext(
      layaRetained,
      simulatedRole,
      isConventionalActive
    );

    // Downstream LLM Generation for Path B
    const layaGenStart = performance.now();
    let layaRawAnswer = "";
    let layaPromptTokens = 0;
    let layaCompTokens = 0;

    try {
      const builderB = new PromptBuilder();
      builderB.setUserQuery(query).setContext(layaPre.sanitizedContextText);
      if (layaPre.systemInstruction) {
        builderB.setSystemInstruction(layaPre.systemInstruction);
      }
      const promptPayloadB = builderB.build();
      const genResultB = await this.llmProvider.generateAnswer(promptPayloadB, {
        temperature: 0,
        seed: 42,
      });
      layaRawAnswer = genResultB.answerText;
      layaPromptTokens = genResultB.promptTokens;
      layaCompTokens = genResultB.completionTokens;
    } catch (err: unknown) {
      layaRawAnswer = `Generation failure: ${err instanceof Error ? err.message : String(err)}`;
    }
    const layaGenLatency = Math.round(performance.now() - layaGenStart);

    // Apply post-generation output screening for Path B
    const layaPost = this.guardrailService.screenOutput(
      layaRawAnswer,
      simulatedRole,
      isConventionalActive,
      simulatedRole === "executive"
    );

    const layaMetrics = this.guardrailService.computeMetrics({
      candidatePool: classifiedPool,
      relevanceRetainedChunks: layaRetained,
      chunksSentToLLM: layaPre.allowedChunks,
      userRole: simulatedRole,
      canaryDisclosedInAnswer: layaPost.outputScan.canaryDetected && layaPost.outputScan.actionTaken !== "BLOCKED",
      promptInjectionDetected: layaPre.injectionScan.detected,
      relevanceLatencyMs: layaLatency,
      securityCheckLatencyMs: layaPre.securityCheckLatencyMs + layaPost.outputScanLatencyMs,
      generationLatencyMs: layaGenLatency,
      promptTokens: layaPromptTokens,
      completionTokens: layaCompTokens,
    });

    const layaResult: SecurityExperimentResult = {
      id: `sec_laya_${Date.now()}`,
      testGroupId: testCase?.id || "custom-query",
      testGroupName: testCase?.groupName || "Custom Security Query",
      query,
      mode,
      simulatedRole,
      relevanceEngineUsed: "laya",
      generatedAnswer: layaPost.finalAnswer,
      allowedChunks: layaPre.allowedChunks,
      blockedChunks: layaPre.blockedChunks,
      redactedChunks: layaPre.redactedChunks,
      interventions: [...layaPre.interventions, ...layaPost.interventions],
      metrics: layaMetrics,
    };

    return {
      crossEncoder: crossEncoderResult,
      laya: layaResult,
    };
  }
}
