// Local Integration Verification Script (Real Ollama + nomic-embed-text)
import { TextDocumentParser } from "../src/lib/parsers/text-parser.ts";
import { DeterministicChunker } from "../src/lib/chunking/chunker.ts";
import { OllamaEmbeddingProvider } from "../src/lib/providers/ollama-embedding-provider.ts";
import { LocalVectorStore } from "../src/lib/vector-store/local-vector-store.ts";
import { SharedRetrieverService } from "../src/server/services/retriever-service.ts";
import path from "path";
import fs from "fs/promises";

async function runLocalVerification() {
  console.log("=== Phase 2 Local Integration Verification ===");

  const sampleDocText = `
Linear Attention and FlashAttention in Long-Context Transformers

Abstract:
Standard Transformer attention exhibits quadratic complexity O(N^2) with respect to sequence length N, presenting a significant computational bottleneck for long documents. 

Linearized Attention Mechanisms:
Linear attention replaces the softmax kernel with feature map projections, reducing attention complexity to O(N). Techniques such as kernel-based linear attention and recurrent state-space models compute causal attention in linear time by leveraging associativity.

FlashAttention and Hardware Acceleration:
FlashAttention restructures the exact attention computation into tiling blocks that fit directly within high-speed SRAM, minimizing memory traffic between HBM and chip. This achieves substantial wall-clock speedups without approximating the attention matrix.

Post-Retrieval Relevance in RAG:
In dense retrieval pipelines, bi-encoders rapidly retrieve top-K passages based on cosine distance. However, candidate chunks often contain peripheral noise. Re-ranking via cross-encoders or specialized relevance evaluation mechanisms prunes irrelevant context before prompt generation.
`.trim();

  const tempStorePath = path.join(process.cwd(), "data", "integration-test-store.json");
  const vectorStore = new LocalVectorStore({ storageFilePath: tempStorePath, autoSave: true });
  await vectorStore.clear();

  const embeddingProvider = new OllamaEmbeddingProvider({ model: "nomic-embed-text" });
  const health = await embeddingProvider.checkHealth();
  console.log("Ollama Health Check:", health);

  if (!health.isAvailable) {
    console.log("Ollama not available, skipping live test.");
    return;
  }

  // 1. Parsing
  const parser = new TextDocumentParser();
  const parsed = await parser.parse(Buffer.from(sampleDocText, "utf-8"), "attention_mechanisms.txt");
  console.log("1. Document parsed:", parsed.filename, "Length:", parsed.text.length, "chars");

  // 2. Chunking
  const chunker = new DeterministicChunker({ chunkSize: 350, chunkOverlap: 60 });
  const chunks = chunker.chunkDocument(parsed);
  console.log("2. Generated Chunks:", chunks.length);

  // 3. Embedding & Indexing
  console.log("3. Generating embeddings via Ollama nomic-embed-text...");
  const embedStart = performance.now();
  const embeddings = await embeddingProvider.embedBatch(chunks.map(c => c.text));
  const embedDuration = (performance.now() - embedStart).toFixed(2);
  console.log(`   Embedded ${chunks.length} chunks in ${embedDuration}ms (Dimension: ${embeddings[0].length})`);

  await vectorStore.insertBatch(chunks.map((c, i) => ({
    id: c.id,
    documentId: c.documentId,
    text: c.text,
    source: c.source,
    pageNumber: c.pageNumber,
    embedding: embeddings[i]
  })));
  console.log("4. Indexed into LocalVectorStore. Entry count:", await vectorStore.count());

  // 4. Query Retrieval
  const retriever = new SharedRetrieverService(vectorStore, embeddingProvider);
  const query = "What attention mechanism mitigates quadratic complexity?";
  console.log(`5. Running query: "${query}"`);

  const pool = await retriever.retrieve(query, { topK: 3 });
  console.log(`6. Shared Candidate Pool retrieved in ${pool.retrievalLatencyMs}ms:`);
  pool.candidateChunks.forEach((c) => {
    console.log(`   Rank #${c.rank} | Cosine: ${c.retrievalScore} | Decision: ${c.decision} | ID: ${c.id}`);
    console.log(`   Snippet: "${c.text.substring(0, 80).replace(/\n/g, ' ')}..."\n`);
  });

  // Cleanup temp store
  await fs.unlink(tempStorePath).catch(() => {});
  console.log("=== Integration Verification Successfully Completed ===");
}

runLocalVerification().catch(console.error);
