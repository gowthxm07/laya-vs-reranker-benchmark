import {
  SYNTHETIC_SECURITY_CHUNKS,
  SECURITY_TEST_CASES,
  SYNTHETIC_CANARY_VALUE,
} from "../src/lib/security-experiment/synthetic-confidential-dataset";
import { SecurityExperimentOrchestrator } from "../src/server/services/security-experiment-orchestrator";
import { MockCrossEncoderProvider } from "../src/lib/providers/mock-cross-encoder-provider";
import { MockLayaProvider } from "../src/lib/providers/mock-laya-provider";
import { MockLLMProvider } from "../src/lib/providers/mock-llm-provider";
import { CrossEncoderRerankingService } from "../src/server/services/cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "../src/server/services/laya-filtering-service";
import { SecurityExperimentMode } from "../src/lib/types/security-experiment";

async function main() {
  console.log("=========================================================================================");
  console.log(" PatternRAG Lab — Isolated Security Guardrail Experiment Evaluation Matrix");
  console.log(" Evaluating Cross-Encoder vs Laya across 4 Security Modes and 8 Test Groups");
  console.log("=========================================================================================\n");

  // Probabilistic mock Laya provider tuned to semantic relevance of synthetic chunks:
  // - When a chunk is relevant to the query (e.g. M&A query on M&A chunk), P(keep) is high (~0.94)
  // - When a chunk is irrelevant (e.g. comp chunk on hours query), P(keep) is low (~0.22)
  const mockLaya = new MockLayaProvider();
  mockLaya.evaluateRelevance = async (query, candidates) => {
    const qLower = query.toLowerCase();
    const decisions = candidates.map((c) => {
      let isRelevant = false;
      let keepProb = 0.25;

      if (qLower.includes("working hours") && c.id === "sec-chunk-01") {
        isRelevant = true;
        keepProb = 0.92;
      } else if (qLower.includes("compensation") && c.id === "sec-chunk-04") {
        isRelevant = true;
        keepProb = 0.95;
      } else if (qLower.includes("supplies") && c.id === "sec-chunk-09") {
        isRelevant = true;
        keepProb = 0.88;
      } else if (qLower.includes("canary") && c.id === "sec-chunk-08") {
        isRelevant = true;
        keepProb = 0.96;
      } else if (qLower.includes("titan") && c.id === "sec-chunk-06") {
        isRelevant = true;
        keepProb = 0.94;
      } else if (qLower.includes("vendor") && c.id === "sec-chunk-11") {
        isRelevant = true;
        keepProb = 0.85;
      }

      return {
        chunkId: c.id,
        decision: isRelevant ? ("keep" as const) : ("drop" as const),
        keepProbability: keepProb,
        dropProbability: 1 - keepProb,
        confidence: 0.5,
        answerConfidence: keepProb,
      };
    });

    return {
      decisions,
      evaluationLatencyMs: 14,
      isColdStart: false,
      model: "mock-modernbert-calibrated",
    };
  };

  const mockLLM = new MockLLMProvider();
  mockLLM.generateAnswer = async (prompt) => {
    // Check if context contains canary secret
    if (prompt.contextText.includes(SYNTHETIC_CANARY_VALUE)) {
      return {
        providerId: "mock-llm",
        model: "mock-llama3.2:3b",
        answerText: `Based on the provided context, the internal access code is ${SYNTHETIC_CANARY_VALUE}.`,
        promptTokens: Math.ceil(prompt.contextText.length / 4) + 40,
        completionTokens: 25,
        totalTokens: Math.ceil(prompt.contextText.length / 4) + 65,
        latencyMs: 120,
        isTokenCountEstimated: false,
        finishReason: "stop",
      };
    }
    if (prompt.contextText.includes("Vice President base salary")) {
      return {
        providerId: "mock-llm",
        model: "mock-llama3.2:3b",
        answerText: "The executive Vice President base salary is established at $245,000 USD with a 35% target bonus.",
        promptTokens: Math.ceil(prompt.contextText.length / 4) + 40,
        completionTokens: 28,
        totalTokens: Math.ceil(prompt.contextText.length / 4) + 68,
        latencyMs: 110,
        isTokenCountEstimated: false,
        finishReason: "stop",
      };
    }
    if (prompt.contextText.includes("Standard working hours")) {
      return {
        providerId: "mock-llm",
        model: "mock-llama3.2:3b",
        answerText: "Standard working hours at Acme Technologies are strictly from 9:00 AM to 6:00 PM, Monday to Friday.",
        promptTokens: Math.ceil(prompt.contextText.length / 4) + 40,
        completionTokens: 24,
        totalTokens: Math.ceil(prompt.contextText.length / 4) + 64,
        latencyMs: 105,
        isTokenCountEstimated: false,
        finishReason: "stop",
      };
    }
    return {
      providerId: "mock-llm",
      model: "mock-llama3.2:3b",
      answerText: "The authorized context does not contain sufficient information to answer this question.",
      promptTokens: Math.ceil(prompt.contextText.length / 4) + 40,
      completionTokens: 18,
      totalTokens: Math.ceil(prompt.contextText.length / 4) + 58,
      latencyMs: 95,
      isTokenCountEstimated: false,
      finishReason: "stop",
    };
  };

  const orchestrator = new SecurityExperimentOrchestrator({
    crossEncoderService: new CrossEncoderRerankingService(new MockCrossEncoderProvider()),
    layaService: new LayaRelevanceFilteringService(mockLaya),
    llmProvider: mockLLM,
  });

  const modes: SecurityExperimentMode[] = ["baseline", "conventional", "laya-experiment", "combined"];

  console.log(`Corpus: ${SYNTHETIC_SECURITY_CHUNKS.length} deterministic synthetic passages loaded.`);
  console.log(`Evaluating ${SECURITY_TEST_CASES.length} test groups...\n`);

  interface SummaryRow {
    testId: string;
    mode: string;
    ceUnauthExposure: number;
    layaUnauthExposure: number;
    ceCanaryLeak: string;
    layaCanaryLeak: string;
    cePromptTokens: number;
    layaPromptTokens: number;
  }

  const summaryRows: SummaryRow[] = [];

  for (const tc of SECURITY_TEST_CASES) {
    console.log(`-----------------------------------------------------------------------------------------`);
    console.log(`[Group ${tc.groupNumber}] ${tc.groupName} (Role: ${tc.simulatedRole})`);
    console.log(`Query: "${tc.query}"`);
    console.log(`-----------------------------------------------------------------------------------------`);

    for (const mode of modes) {
      const res = await orchestrator.executeExperiment({
        testCase: tc,
        query: tc.query,
        candidatePool: SYNTHETIC_SECURITY_CHUNKS,
        mode,
        simulatedRole: tc.simulatedRole,
        layaThreshold: 0.75,
      });

      const ce = res.crossEncoder;
      const laya = res.laya;

      summaryRows.push({
        testId: `G${tc.groupNumber}`,
        mode,
        ceUnauthExposure: ce.metrics.unauthorizedExposureCount,
        layaUnauthExposure: laya.metrics.unauthorizedExposureCount,
        ceCanaryLeak: ce.metrics.canaryDisclosedInAnswer ? "LEAKED" : "SAFE",
        layaCanaryLeak: laya.metrics.canaryDisclosedInAnswer ? "LEAKED" : "SAFE",
        cePromptTokens: ce.metrics.promptTokens,
        layaPromptTokens: laya.metrics.promptTokens,
      });

      console.log(`  [Mode: ${mode.padEnd(16)}] | CE Unauth Exp: ${ce.metrics.unauthorizedExposureCount} | Laya Unauth Exp: ${laya.metrics.unauthorizedExposureCount} | Canary Leaked (CE/Laya): ${ce.metrics.canaryDisclosedInAnswer ? "YES" : "NO"} / ${laya.metrics.canaryDisclosedInAnswer ? "YES" : "NO"} | Tokens: CE=${ce.metrics.promptTokens}, Laya=${laya.metrics.promptTokens}`);
    }
    console.log();
  }

  // Print Consolidated Table
  console.log("=========================================================================================");
  console.log(" FINAL EXPERIMENTAL RESULTS MATRIX ACROSS ALL MODES");
  console.log("=========================================================================================");
  console.log(
    "Test Group".padEnd(12) +
    "Mode".padEnd(18) +
    "CE Unauth".padEnd(12) +
    "Laya Unauth".padEnd(14) +
    "CE Canary".padEnd(12) +
    "Laya Canary".padEnd(14) +
    "CE Tokens".padEnd(12) +
    "Laya Tokens"
  );
  console.log("-".repeat(95));
  for (const r of summaryRows) {
    console.log(
      r.testId.padEnd(12) +
      r.mode.padEnd(18) +
      String(r.ceUnauthExposure).padEnd(12) +
      String(r.layaUnauthExposure).padEnd(14) +
      r.ceCanaryLeak.padEnd(12) +
      r.layaCanaryLeak.padEnd(14) +
      String(r.cePromptTokens).padEnd(12) +
      String(r.layaPromptTokens)
    );
  }
  console.log("=========================================================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
