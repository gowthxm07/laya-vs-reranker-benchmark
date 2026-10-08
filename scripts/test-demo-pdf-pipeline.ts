import fs from "fs";
import path from "path";
import { DocumentIngestionService } from "../src/server/services/ingestion-service";
import { SharedRetrieverService } from "../src/server/services/retriever-service";
import { RAGComparisonOrchestrator } from "../src/server/services/rag-comparison-orchestrator";
import { CrossEncoderRerankingService } from "../src/server/services/cross-encoder-reranking-service";
import { LayaRelevanceFilteringService } from "../src/server/services/laya-filtering-service";
import { MockLLMProvider } from "../src/lib/providers/mock-llm-provider";
import { MockCrossEncoderProvider } from "../src/lib/providers/mock-cross-encoder-provider";
import { MockLayaProvider } from "../src/lib/providers/mock-laya-provider";
import { MockEmbeddingProvider } from "../src/lib/providers/mock-embedding-provider";
import { LocalVectorStore } from "../src/lib/vector-store/local-vector-store";

async function main() {
  const isLive = process.argv.includes("--live");
  const limitArg = process.argv.find(a => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  console.log("=================================================================");
  console.log(" PatternRAG Lab — Demo Document Pipeline End-to-End Test");
  console.log(` Mode: ${isLive ? "Live Local Stack (Ollama + Workers)" : "Deterministic Pipeline Mode"}`);
  console.log("=================================================================\n");

  const pdfPath = path.join(process.cwd(), "demo_document.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("Error: demo_document.pdf not found at:", pdfPath);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  console.log(`[1] Loaded demo_document.pdf (${pdfBuffer.length} bytes)`);

  // Ingest document into dedicated test vector store
  const vectorStore = new LocalVectorStore({
    storageFilePath: "./data/demo-vector-store.json",
  });
  vectorStore.clear();

  const embeddingProvider = isLive ? undefined : new MockEmbeddingProvider();
  const ingestionService = new DocumentIngestionService(vectorStore, embeddingProvider);

  console.log("[2] Ingesting demo_document.pdf via DocumentIngestionService...");
  const ingestionResult = await ingestionService.ingestDocument(
    pdfBuffer,
    "demo_document.pdf",
    "application/pdf"
  );

  console.log(`    Document ID:    ${ingestionResult.document.id}`);
  console.log(`    Page Count:     ${ingestionResult.document.pageCount}`);
  console.log(`    Chunks Indexed: ${ingestionResult.chunkCount}`);
  console.log(`    Parse Time:     ${ingestionResult.timings.parseDurationMs.toFixed(1)}ms`);
  console.log(`    Chunk Time:     ${ingestionResult.timings.chunkDurationMs.toFixed(1)}ms`);
  console.log(`    Index Time:     ${ingestionResult.timings.indexingDurationMs.toFixed(1)}ms\n`);

  const retriever = new SharedRetrieverService(vectorStore, embeddingProvider);

  let orchestrator: RAGComparisonOrchestrator;
  if (!isLive) {
    const mockCE = new CrossEncoderRerankingService(new MockCrossEncoderProvider());
    const mockLayaProvider = new MockLayaProvider();
    const mockLaya = new LayaRelevanceFilteringService(mockLayaProvider);
    const mockLLM = new MockLLMProvider();
    orchestrator = new RAGComparisonOrchestrator({
      crossEncoderService: mockCE,
      layaService: mockLaya,
      llmProvider: mockLLM,
    });
  } else {
    orchestrator = new RAGComparisonOrchestrator();
  }

  const testQueries = [
    {
      id: "Q1",
      query: "What are the standard working hours?",
      isAnswerable: true,
      expectedKeyword: "9:00 AM to 6:00 PM",
    },
    {
      id: "Q2",
      query: "How many casual leave days are provided each year?",
      isAnswerable: true,
      expectedKeyword: "12 days",
    },
    {
      id: "Q3",
      query: "When should planned leave be submitted?",
      isAnswerable: true,
      expectedKeyword: "2 working days",
    },
    {
      id: "Q4",
      query: "What security controls are required for company systems?",
      isAnswerable: true,
      expectedKeyword: "MFA",
    },
    {
      id: "Q5",
      query: "What is the deadline for reporting damaged company equipment?",
      isAnswerable: true,
      expectedKeyword: "1 business day",
    },
    {
      id: "Q6",
      query: "What approval is required for expenses above ₹10,000?",
      isAnswerable: true,
      expectedKeyword: "manager approval",
    },
    {
      id: "Q7",
      query: "What is the company's maternity leave policy?",
      isAnswerable: false,
      expectedKeyword: "insufficient evidence",
    },
    {
      id: "Q8",
      query: "What is the annual performance bonus?",
      isAnswerable: false,
      expectedKeyword: "insufficient evidence",
    },
  ];

  console.log("-----------------------------------------------------------------");
  console.log(" [3] Executing 8 Pipeline Test Queries");
  console.log("-----------------------------------------------------------------\n");

  const resultsSummary: Array<{
    queryId: string;
    query: string;
    isAnswerable: boolean;
    retrievedCandidates: number;
    ceRetained: number;
    layaRetained: number;
    layaContextReduction: string;
    ceTopPages: string;
    layaPages: string;
    answerA_Preview: string;
    answerB_Preview: string;
  }> = [];

  const queriesToRun = limit ? testQueries.slice(0, limit) : testQueries;
  for (const q of queriesToRun) {
    console.log(`\n=================================================================`);
    console.log(`[${q.id}] Query: "${q.query}" (${q.isAnswerable ? "ANSWERABLE" : "UNANSWERABLE"})`);
    console.log(`=================================================================`);

    // 1. Shared Vector Retrieval
    const pool = await retriever.retrieve(q.query, { topK: 5 });
    console.log(`Retrieved ${pool.candidateChunks.length} candidate chunks:`);
    for (const c of pool.candidateChunks) {
      console.log(`  - [${c.id}] Page ${c.pageNumber}: "${c.text.slice(0, 90).replace(/\n/g, ' ')}..."`);
    }

    // 2. Controlled Comparison
    const comparison = await orchestrator.compareCandidatePool(pool, { mode: "native" });

    const ceResult = comparison.crossEncoder;
    const layaResult = comparison.laya;

    const cePages = ceResult.selectedChunks.map(c => `p${c.pageNumber}`).join(", ");
    const layaPages = layaResult.selectedChunks.length > 0 
      ? layaResult.selectedChunks.map(c => `p${c.pageNumber}`).join(", ")
      : "(empty - 100% pruned)";

    const layaReductionPercent = pool.candidateChunks.length > 0 
      ? ((pool.candidateChunks.length - layaResult.retainedCount) / pool.candidateChunks.length) * 100 
      : 0;

    console.log(`\nPath A (Cross-Encoder): Retained ${ceResult.selectedChunks.length}/${pool.candidateChunks.length} chunks [${cePages}]`);
    console.log(`Answer A:\n"${ceResult.answer.slice(0, 200).replace(/\n/g, ' ')}..."`);

    console.log(`\nPath B (Laya Filter):   Retained ${layaResult.selectedChunks.length}/${pool.candidateChunks.length} chunks [${layaPages}] (${layaReductionPercent.toFixed(1)}% reduction)`);
    console.log(`Answer B:\n"${layaResult.answer.slice(0, 200).replace(/\n/g, ' ')}..."`);

    resultsSummary.push({
      queryId: q.id,
      query: q.query,
      isAnswerable: q.isAnswerable,
      retrievedCandidates: pool.candidateChunks.length,
      ceRetained: ceResult.selectedChunks.length,
      layaRetained: layaResult.selectedChunks.length,
      layaContextReduction: `${layaReductionPercent.toFixed(1)}%`,
      ceTopPages: cePages,
      layaPages,
      answerA_Preview: ceResult.answer.slice(0, 80).replace(/\n/g, ' '),
      answerB_Preview: layaResult.answer.slice(0, 80).replace(/\n/g, ' '),
    });
  }

  console.log("\n\n=================================================================");
  console.log("                  DEMO DOCUMENT TEST SUMMARY TABLE                ");
  console.log("=================================================================");
  console.table(resultsSummary);

  // Clean up test vector store
  try {
    if (fs.existsSync("./data/demo-vector-store.json")) {
      fs.unlinkSync("./data/demo-vector-store.json");
    }
  } catch {}

  console.log("\nPipeline verification on demo_document.pdf complete.");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
