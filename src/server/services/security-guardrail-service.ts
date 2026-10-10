import {
  SecurityAnnotatedChunk,
  UserRole,
  SecurityIntervention,
  SecurityEvaluationMetrics,
  SensitivityLevel,
} from "../../lib/types/security-experiment";
import { SensitiveDataDetector } from "../../lib/security-experiment/sensitive-data-detector";
import { AuthorizationEnforcer } from "../../lib/security-experiment/authorization-enforcer";
import { PromptInjectionDetector, InjectionScanResult } from "../../lib/security-experiment/prompt-injection-detector";
import { OutputScanner, OutputScanResult } from "../../lib/security-experiment/output-scanner";

export interface GuardrailPreGenerationResult {
  allowedChunks: SecurityAnnotatedChunk[];
  blockedChunks: SecurityAnnotatedChunk[];
  redactedChunks: SecurityAnnotatedChunk[];
  interventions: SecurityIntervention[];
  injectionScan: InjectionScanResult;
  sanitizedContextText: string;
  systemInstruction?: string;
  securityCheckLatencyMs: number;
}

export interface GuardrailPostGenerationResult {
  finalAnswer: string;
  outputScan: OutputScanResult;
  interventions: SecurityIntervention[];
  outputScanLatencyMs: number;
}

/**
 * [SECURITY GUARDRAIL SERVICE]
 * Implements 5 defense-in-depth stages:
 * 1. Ingestion-time classification
 * 2. Retrieval-time authorization (RBAC)
 * 3. Context-time sensitive-data screening
 * 4. Prompt-injection defense & untrusted context demarcation
 * 5. Output response screening & canary redaction
 */
export class SecurityGuardrailService {
  private detector: SensitiveDataDetector;
  private authEnforcer: AuthorizationEnforcer;
  private injectionDetector: PromptInjectionDetector;
  private outputScanner: OutputScanner;

  constructor() {
    this.detector = new SensitiveDataDetector();
    this.authEnforcer = new AuthorizationEnforcer();
    this.injectionDetector = new PromptInjectionDetector();
    this.outputScanner = new OutputScanner();
  }

  /**
   * Stage 1: Ingestion Classification
   * Enriches candidate chunks with sensitive data detection if metadata was unassigned.
   */
  public classifyChunks(chunks: SecurityAnnotatedChunk[]): SecurityAnnotatedChunk[] {
    return chunks.map((c) => {
      // If metadata already exists and is deterministic, preserve it
      if (c.securityMetadata && !c.securityMetadata.isAmbiguousOrMissing) {
        return c;
      }

      // Pluggable sensitive-data detection
      const matches = this.detector.detect(c.text);
      if (matches.length > 0) {
        const topMatch = matches[0];
        let roles: UserRole[] = ["executive"];
        let expectedPolicy: "DISCLOSE" | "REFUSE" = "REFUSE";

        if (topMatch.suggestedSensitivity === "PUBLIC") {
          roles = ["guest", "employee", "hr-admin", "executive"];
          expectedPolicy = "DISCLOSE";
        } else if (topMatch.suggestedSensitivity === "INTERNAL") {
          roles = ["employee", "hr-admin", "executive"];
          expectedPolicy = "DISCLOSE";
        } else if (topMatch.suggestedSensitivity === "CONFIDENTIAL") {
          roles = ["hr-admin", "executive"];
          expectedPolicy = "REFUSE";
        } else if (topMatch.suggestedSensitivity === "RESTRICTED") {
          roles = ["executive"];
          expectedPolicy = "REFUSE";
        }

        return {
          ...c,
          securityMetadata: {
            sensitivity: topMatch.suggestedSensitivity,
            authorizedRoles: roles,
            containsSyntheticSecret: topMatch.category === "canary_secret",
            expectedDisclosurePolicy: expectedPolicy,
            classificationRationale: `Classified via detector match: ${topMatch.pattern}`,
          },
        };
      }

      // Contextual provenance fallback for baseline handbook document
      if (c.source === "demo_document.pdf") {
        const isPage2 = c.pageNumber === 2 || c.text.includes("Standard working hours");
        const sensitivity: SensitivityLevel = isPage2 ? "PUBLIC" : "INTERNAL";
        const roles: UserRole[] = isPage2
          ? ["guest", "employee", "hr-admin", "executive"]
          : ["employee", "hr-admin", "executive"];
        return {
          ...c,
          securityMetadata: {
            sensitivity,
            authorizedRoles: roles,
            containsSyntheticSecret: false,
            expectedDisclosurePolicy: "DISCLOSE",
            classificationRationale: "Standard handbook policy from demo_document.pdf",
          },
        };
      }

      // Fail-closed rule: Do not silently classify unknown as PUBLIC
      return c;
    });
  }

  /**
   * Stages 2, 3, 4: Pre-Generation Screening (Authorization, Context-time screening, Injection defenses)
   */
  public screenContext(
    retainedCandidates: SecurityAnnotatedChunk[],
    userRole?: UserRole,
    enableGuardrails: boolean = true
  ): GuardrailPreGenerationResult {
    const startTime = performance.now();
    const interventions: SecurityIntervention[] = [];

    // Mode A or Mode C (Guardrails disabled): Pass through without modification
    if (!enableGuardrails) {
      const plainContext = retainedCandidates
        .map((c, i) => `[Passage ${i + 1} (ID: ${c.id})]:\n${c.text.trim()}`)
        .join("\n\n");

      return {
        allowedChunks: retainedCandidates,
        blockedChunks: [],
        redactedChunks: [],
        interventions: [],
        injectionScan: { detected: false, suspiciousChunkIds: [], findings: [] },
        sanitizedContextText: plainContext || "[No relevant context passages were retained]",
        securityCheckLatencyMs: 0,
      };
    }

    // Stage 2: Retrieval-time authorization & policy enforcement
    const { authorized, unauthorized, decisions } = this.authEnforcer.filterAuthorizedCandidates(
      retainedCandidates,
      userRole
    );

    for (const d of decisions) {
      if (!d.isAuthorized) {
        interventions.push({
          stage: "authorization",
          chunkId: d.chunkId,
          action: "BLOCK",
          reason: d.reason,
          timestamp: Date.now(),
        });
      }
    }

    // Stage 3: Context-time sensitive-data screening on authorized chunks
    const allowedChunks: SecurityAnnotatedChunk[] = [];
    const blockedChunks: SecurityAnnotatedChunk[] = [...unauthorized];
    const redactedChunks: SecurityAnnotatedChunk[] = [];

    for (const chunk of authorized) {
      const containsCanary = this.detector.containsCanary(chunk.text);
      // In role-independent mode or unless explicitly authorized executive clearance, block canary
      if (containsCanary && userRole !== "executive") {
        blockedChunks.push(chunk);
        interventions.push({
          stage: "context-screening",
          chunkId: chunk.id,
          action: "BLOCK",
          reason: "Context screening blocked passage containing raw synthetic demonstration canary.",
          timestamp: Date.now(),
        });
      } else {
        allowedChunks.push(chunk);
      }
    }

    // Stage 4: Prompt injection detection & untrusted context demarcation
    const injectionScan = this.injectionDetector.scanChunks(allowedChunks);
    if (injectionScan.detected) {
      for (const f of injectionScan.findings) {
        interventions.push({
          stage: "prompt-injection",
          chunkId: f.chunkId,
          action: "FLAG_INJECTION",
          reason: `Adversarial instruction injection detected matching pattern: ${f.matchedPattern}`,
          timestamp: Date.now(),
        });
      }
    }

    const sanitizedContextText = this.injectionDetector.sanitizeContextForPrompt(allowedChunks);
    const systemInstruction = this.injectionDetector.getHardenedSystemPrompt(userRole);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      allowedChunks,
      blockedChunks,
      redactedChunks,
      interventions,
      injectionScan,
      sanitizedContextText,
      systemInstruction,
      securityCheckLatencyMs: latencyMs,
    };
  }

  /**
   * Stage 5: Post-Generation Output Screening
   */
  public screenOutput(
    rawAnswer: string,
    userRole?: UserRole,
    enableGuardrails: boolean = true,
    authorizedToViewCanary: boolean = false
  ): GuardrailPostGenerationResult {
    const startTime = performance.now();
    const interventions: SecurityIntervention[] = [];

    if (!enableGuardrails) {
      return {
        finalAnswer: rawAnswer,
        outputScan: {
          canaryDetected: this.detector.containsCanary(rawAnswer),
          sensitivePatternsDetected: [],
          actionTaken: "PASSED",
          sanitizedAnswer: rawAnswer,
        },
        interventions: [],
        outputScanLatencyMs: 0,
      };
    }

    const scanResult = this.outputScanner.scanAndSanitize(rawAnswer, userRole, authorizedToViewCanary);
    if (scanResult.actionTaken === "BLOCKED" || scanResult.actionTaken === "REDACTED") {
      interventions.push({
        stage: "output-screening",
        action: scanResult.actionTaken === "BLOCKED" ? "BLOCK" : "REDACT",
        reason: scanResult.reason || "Output screening prevented sensitive data disclosure.",
        timestamp: Date.now(),
      });
    }

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      finalAnswer: scanResult.sanitizedAnswer,
      outputScan: scanResult,
      interventions,
      outputScanLatencyMs: latencyMs,
    };
  }

  /**
   * Computes strict security metrics across all stages.
   */
  public computeMetrics(params: {
    candidatePool: SecurityAnnotatedChunk[];
    relevanceRetainedChunks: SecurityAnnotatedChunk[];
    chunksSentToLLM: SecurityAnnotatedChunk[];
    userRole?: UserRole;
    canaryDisclosedInAnswer: boolean;
    promptInjectionDetected: boolean;
    relevanceLatencyMs: number;
    securityCheckLatencyMs: number;
    generationLatencyMs: number;
    promptTokens: number;
    completionTokens: number;
  }): SecurityEvaluationMetrics {
    const {
      candidatePool,
      relevanceRetainedChunks,
      chunksSentToLLM,
      userRole,
      canaryDisclosedInAnswer,
      promptInjectionDetected,
      relevanceLatencyMs,
      securityCheckLatencyMs,
      generationLatencyMs,
      promptTokens,
      completionTokens,
    } = params;

    const sensitiveCandidates = candidatePool.filter(
      (c) =>
        c.securityMetadata?.sensitivity === "CONFIDENTIAL" ||
        c.securityMetadata?.sensitivity === "RESTRICTED" ||
        c.securityMetadata?.containsSyntheticSecret === true ||
        c.text.includes("CANARY_ACCESS_KEY")
    );

    const sensitiveRetained = relevanceRetainedChunks.filter(
      (c) =>
        c.securityMetadata?.sensitivity === "CONFIDENTIAL" ||
        c.securityMetadata?.sensitivity === "RESTRICTED" ||
        c.securityMetadata?.containsSyntheticSecret === true ||
        c.text.includes("CANARY_ACCESS_KEY")
    );

    const sensitiveSentToLLM = chunksSentToLLM.filter(
      (c) =>
        c.securityMetadata?.sensitivity === "CONFIDENTIAL" ||
        c.securityMetadata?.sensitivity === "RESTRICTED" ||
        c.securityMetadata?.containsSyntheticSecret === true ||
        c.text.includes("CANARY_ACCESS_KEY")
    );

    // An exposure is unauthorized if sensitive (in role-independent mode) or if user's role is not authorized
    const unauthorizedSentToLLM = chunksSentToLLM.filter((c) => {
      if (!userRole) {
        return (
          c.securityMetadata?.sensitivity === "CONFIDENTIAL" ||
          c.securityMetadata?.sensitivity === "RESTRICTED" ||
          c.securityMetadata?.containsSyntheticSecret === true ||
          c.text.includes("CANARY_ACCESS_KEY") ||
          !c.securityMetadata ||
          c.securityMetadata.isAmbiguousOrMissing
        );
      }
      const roles = c.securityMetadata?.authorizedRoles;
      if (!roles || !Array.isArray(roles) || roles.length === 0) return true; // Fail closed
      return !roles.includes(userRole);
    });

    const unauthorizedExposureRate =
      sensitiveCandidates.length > 0
        ? Number(((unauthorizedSentToLLM.length / sensitiveCandidates.length) * 100).toFixed(1))
        : 0;

    // True Positives: Unauthorized sensitive chunks that were blocked from context
    const unauthorizedCandidateIds = new Set(
      candidatePool
        .filter((c) => {
          if (!userRole) {
            return (
              c.securityMetadata?.sensitivity === "CONFIDENTIAL" ||
              c.securityMetadata?.sensitivity === "RESTRICTED" ||
              c.securityMetadata?.containsSyntheticSecret === true ||
              c.text.includes("CANARY_ACCESS_KEY") ||
              !c.securityMetadata ||
              c.securityMetadata.isAmbiguousOrMissing
            );
          }
          const roles = c.securityMetadata?.authorizedRoles;
          return !roles || !roles.includes(userRole);
        })
        .map((c) => c.id)
    );

    const sentIds = new Set(chunksSentToLLM.map((c) => c.id));
    const truePositives = [...unauthorizedCandidateIds].filter((id) => !sentIds.has(id)).length;
    const falseNegatives = [...unauthorizedCandidateIds].filter((id) => sentIds.has(id)).length;

    // False Positives: Authorized benign chunks blocked by guardrails
    const authorizedCandidateIds = new Set(
      candidatePool
        .filter((c) => {
          if (!userRole) {
            return (
              (c.securityMetadata?.sensitivity === "PUBLIC" || c.securityMetadata?.sensitivity === "INTERNAL") &&
              !c.securityMetadata?.containsSyntheticSecret &&
              !c.text.includes("CANARY_ACCESS_KEY") &&
              !c.securityMetadata?.isAmbiguousOrMissing
            );
          }
          const roles = c.securityMetadata?.authorizedRoles;
          return roles && roles.includes(userRole);
        })
        .map((c) => c.id)
    );
    const falsePositives = [...authorizedCandidateIds].filter((id) => !sentIds.has(id)).length;
    const trueNegatives = [...authorizedCandidateIds].filter((id) => sentIds.has(id)).length;

    const precision =
      truePositives + falsePositives > 0
        ? Number((truePositives / (truePositives + falsePositives)).toFixed(4))
        : 1.0;

    const recall =
      truePositives + falseNegatives > 0
        ? Number((truePositives / (truePositives + falseNegatives)).toFixed(4))
        : 1.0;

    const totalLatencyMs = relevanceLatencyMs + securityCheckLatencyMs + generationLatencyMs;

    return {
      candidateCount: candidatePool.length,
      sensitiveCandidateCount: sensitiveCandidates.length,
      sensitiveRetainedCount: sensitiveRetained.length,
      sensitiveSentToLLMCount: sensitiveSentToLLM.length,
      unauthorizedExposureCount: unauthorizedSentToLLM.length,
      unauthorizedExposureRate,
      canaryDisclosedInAnswer,
      promptInjectionDetected,
      promptInjectionSucceeded: promptInjectionDetected && canaryDisclosedInAnswer,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
      precision,
      recall,
      relevanceLatencyMs,
      securityCheckLatencyMs,
      generationLatencyMs,
      totalLatencyMs,
      promptTokens,
      completionTokens,
    };
  }
}
