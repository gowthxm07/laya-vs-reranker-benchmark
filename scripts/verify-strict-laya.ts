import fs from "fs";
import path from "path";
import { DocumentIngestionService } from "../src/server/services/ingestion-service";
import { SharedRetrieverService } from "../src/server/services/retriever-service";
import { RAGComparisonOrchestrator } from "../src/server/services/rag-comparison-orchestrator";
import { LocalVectorStore } from "../src/lib/vector-store/local-vector-store";

async function main() {
  console.log("=================================================================");
  console.log(" PatternRAG Lab — Live Strict Laya Interactive Verification");
  console.log(" Query: 'What are the standard working hours?'");
  console.log(" Document: demo_document.pdf");
  console.log(" Comparing: Run A (Baseline tau=0.50) vs Run B (Strict tau=0.75)");
  console.log("=================================================================\n");

  const pdfPath = path.join(process.cwd(), "demo_document.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("Error: demo_document.pdf not found at:", pdfPath);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log(`[1] Loaded demo_document.pdf (${pdfBuffer.length} bytes)`);

  // Ingest document into dedicated verification vector store
  const vectorStore = new LocalVectorStore({
    storageFilePath: "./data/strict-verify-vector-store.json",
  });
  vectorStore.clear();

  const ingestionService = new DocumentIngestionService(vectorStore);
  console.log("[2] Ingesting demo_document.pdf into vector store...");
  const ingestionResult = await ingestionService.ingestDocument(
    pdfBuffer,
    "demo_document.pdf",
    "application/pdf"
  );
  console.log(`    Chunks Indexed: ${ingestionResult.chunkCount}`);

  const retriever = new SharedRetrieverService(vectorStore);
  const query = "What are the standard working hours?";
  console.log(`\n[3] Retrieving Top-10 Candidates for query: "${query}"...`);
  const pool = await retriever.retrieve(query, { topK: 10 });
  console.log(`    Retrieved ${pool.candidateChunks.length} candidates in shared pool.`);

  console.log("\n    Candidate pool summary:");
  for (let i = 0; i < pool.candidateChunks.length; i++) {
    const c = pool.candidateChunks[i];
    const preview = c.text.replace(/\s+/g, " ").substring(0, 70);
    console.log(`    [#${i + 1}] ID: ${c.id} | p.${c.pageNumber} | "${preview}..."`);
  }

  const orchestrator = new RAGComparisonOrchestrator();

  // -------------------------------------------------------------
  // RUN A: BASELINE (tau = undefined / 0.50)
  // -------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(" [RUN A] BASELINE COMPARISON (Native Mode, tau = undefined / 0.50)");
  console.log("=================================================================");
  const startA = Date.now();
  const resultA = await orchestrator.compareCandidatePool(pool, {
    mode: "native",
    topN: 5,
    layaThreshold: undefined,
  });
  const durationA = Date.now() - startA;

  console.log("\n--- Run A: Cross-Encoder ---");
  console.log(`  Retained: ${resultA.crossEncoder.retainedCount} / ${pool.candidateChunks.length}`);
  console.log(`  Selected IDs: ${resultA.crossEncoder.selectedChunkIds.join(", ")}`);
  console.log(`  Prompt Tokens: ${resultA.crossEncoder.promptTokens}`);
  console.log(`  Completion Tokens: ${resultA.crossEncoder.completionTokens}`);
  console.log(`  Relevance Latency: ${resultA.crossEncoder.relevanceLatencyMs.toFixed(1)}ms`);
  console.log(`  Total Latency: ${resultA.crossEncoder.totalLatencyMs.toFixed(1)}ms`);
  console.log(`  Answer:\n  "${resultA.crossEncoder.answer.trim()}"`);

  console.log("\n--- Run A: Laya (Baseline) ---");
  console.log(`  Filtering Threshold: ${resultA.laya.filteringThreshold ?? "none (default 0.50)"}`);
  console.log(`  Retained: ${resultA.laya.retainedCount} / ${pool.candidateChunks.length}`);
  console.log(`  Discarded: ${resultA.laya.discardedCount}`);
  console.log(`  Selected IDs: ${resultA.laya.selectedChunkIds.join(", ")}`);
  console.log(`  Prompt Tokens: ${resultA.laya.promptTokens}`);
  console.log(`  Completion Tokens: ${resultA.laya.completionTokens}`);
  console.log(`  Relevance Latency: ${resultA.laya.relevanceLatencyMs.toFixed(1)}ms`);
  console.log(`  Total Latency: ${resultA.laya.totalLatencyMs.toFixed(1)}ms`);
  console.log(`  Answer:\n  "${resultA.laya.answer.trim()}"`);

  // Print all candidate decisions and probabilities from Run A
  const evalChunksA = (resultA.laya.metadata?.evaluatedCandidates as any[]) || [];
  if (evalChunksA.length > 0) {
    console.log("\n  Laya Decisions & Probabilities in Run A:");
    for (const ec of evalChunksA) {
      console.log(`    - ID: ${ec.id} | decision: ${ec.layaDecision} | isRetained: ${ec.isRetained} | P(keep): ${ec.keepProbability?.toFixed(4)} | reason: ${ec.relevanceRationale || "N/A"}`);
    }
  }

  // -------------------------------------------------------------
  // RUN B: STRICT (tau = 0.75)
  // -------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(" [RUN B] STRICT LAYA COMPARISON (Native Mode, tau = 0.75)");
  console.log("=================================================================");
  const startB = Date.now();
  const resultB = await orchestrator.compareCandidatePool(pool, {
    mode: "native",
    topN: 5,
    layaThreshold: 0.75,
  });
  const durationB = Date.now() - startB;

  console.log("\n--- Run B: Cross-Encoder ---");
  console.log(`  Retained: ${resultB.crossEncoder.retainedCount} / ${pool.candidateChunks.length}`);
  console.log(`  Selected IDs: ${resultB.crossEncoder.selectedChunkIds.join(", ")}`);
  console.log(`  Prompt Tokens: ${resultB.crossEncoder.promptTokens}`);
  console.log(`  Completion Tokens: ${resultB.crossEncoder.completionTokens}`);
  console.log(`  Relevance Latency: ${resultB.crossEncoder.relevanceLatencyMs.toFixed(1)}ms`);
  console.log(`  Total Latency: ${resultB.crossEncoder.totalLatencyMs.toFixed(1)}ms`);
  console.log(`  Answer:\n  "${resultB.crossEncoder.answer.trim()}"`);

  console.log("\n--- Run B: Laya (Strict tau = 0.75) ---");
  console.log(`  Filtering Threshold: ${resultB.laya.filteringThreshold}`);
  console.log(`  Retained: ${resultB.laya.retainedCount} / ${pool.candidateChunks.length}`);
  console.log(`  Discarded: ${resultB.laya.discardedCount}`);
  console.log(`  Selected IDs: ${resultB.laya.selectedChunkIds.join(", ")}`);
  console.log(`  Prompt Tokens: ${resultB.laya.promptTokens}`);
  console.log(`  Completion Tokens: ${resultB.laya.completionTokens}`);
  console.log(`  Relevance Latency: ${resultB.laya.relevanceLatencyMs.toFixed(1)}ms`);
  console.log(`  Total Latency: ${resultB.laya.totalLatencyMs.toFixed(1)}ms`);
  console.log(`  Answer:\n  "${resultB.laya.answer.trim()}"`);

  // Print all candidate decisions and probabilities from Run B
  const evalChunksB = (resultB.laya.metadata?.evaluatedCandidates as any[]) || [];
  if (evalChunksB.length > 0) {
    console.log("\n  Laya Decisions & Probabilities in Run B:");
    for (const ec of evalChunksB) {
      console.log(`    - ID: ${ec.id} | decision: ${ec.layaDecision} | isRetained: ${ec.isRetained} | P(keep): ${ec.keepProbability?.toFixed(4)} | reason: ${ec.relevanceRationale || "N/A"}`);
    }
  }

  // -------------------------------------------------------------
  // DELTA & EFFICIENCY AUDIT
  // -------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(" TOKEN & CONTEXT EFFICIENCY AUDIT SUMMARY");
  console.log("=================================================================");
  console.log(`  Candidates Evaluated:         ${pool.candidateChunks.length}`);
  console.log(`  Run A (Baseline tau=0.50):    ${resultA.laya.retainedCount} chunks kept, ${resultA.laya.promptTokens} prompt tokens`);
  console.log(`  Run B (Strict tau=0.75):      ${resultB.laya.retainedCount} chunks kept, ${resultB.laya.promptTokens} prompt tokens`);
  const tokenSaved = resultA.laya.promptTokens - resultB.laya.promptTokens;
  const tokenPct = ((tokenSaved / Math.max(1, resultA.laya.promptTokens)) * 100).toFixed(1);
  const chunksSaved = resultA.laya.retainedCount - resultB.laya.retainedCount;
  console.log(`  Prompt Token Reduction:       ${tokenSaved} tokens saved (${tokenPct}% reduction)`);
  console.log(`  Retained Chunks Reduction:    ${chunksSaved} chunks pruned`);
  console.log(`  Cross-Encoder Baseline:       ${resultB.crossEncoder.retainedCount} chunks, ${resultB.crossEncoder.promptTokens} prompt tokens`);
  console.log("=================================================================\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
