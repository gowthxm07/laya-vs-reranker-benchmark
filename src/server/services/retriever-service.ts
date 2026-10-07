import { IRetriever, RetrievalOptions } from "@/lib/interfaces/retriever";
import { IVectorStore } from "@/lib/interfaces/vector-store";
import { EmbeddingProvider } from "@/lib/interfaces/embedding-provider";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { Chunk } from "@/lib/types/chunk";
import { getGlobalVectorStore } from "@/lib/vector-store/local-vector-store";
import { EmbeddingProviderFactory } from "@/lib/providers/embedding-provider-factory";
import { IObservablePipeline } from "@/lib/interfaces/observer";

export class SharedRetrieverService implements IRetriever {
  private vectorStore: IVectorStore;
  private embeddingProvider: EmbeddingProvider;
  private observerSubject?: IObservablePipeline;

  constructor(
    vectorStore?: IVectorStore,
    embeddingProvider?: EmbeddingProvider,
    observerSubject?: IObservablePipeline
  ) {
    this.vectorStore = vectorStore || getGlobalVectorStore();
    this.embeddingProvider =
      embeddingProvider || EmbeddingProviderFactory.getProvider();
    this.observerSubject = observerSubject;
  }

  async retrieve(
    query: string,
    options?: RetrievalOptions
  ): Promise<CandidateChunkPool> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error("Retrieval query cannot be empty.");
    }

    const topK = options?.topK ?? 10;
    const similarityThreshold = options?.similarityThreshold;
    const documentId = options?.documentId;

    const startTime = performance.now();

    // 1. Lifecycle event: Retrieval started
    if (this.observerSubject) {
      this.observerSubject.notifyObservers({
        type: "phase:started",
        event: {
          id: `evt_ret_start_${Date.now()}`,
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "retrieval_started",
          label: "Query vectorization & search started",
          status: "running",
          details: { query: trimmedQuery, topK, model: this.embeddingProvider.model },
        },
      });
    }

    // 2. Embed user query using configured local embedding model
    const queryVector = await this.embeddingProvider.embedText(trimmedQuery);

    // 3. Perform vector similarity search
    const searchResults = await this.vectorStore.search(queryVector, topK, {
      minScore: similarityThreshold,
      documentId,
    });

    const elapsedMs = performance.now() - startTime;

    // 4. Map vector search results to un-reranked candidate Chunks
    // IMPORTANT: retriever does NOT perform post-retrieval relevance filtering.
    // Chunks are strictly marked as 'pending'.
    const candidateChunks: Chunk[] = searchResults.map((res) => ({
      id: res.entry.id,
      documentId: res.entry.documentId,
      text: res.entry.text,
      source: res.entry.source,
      pageNumber: res.entry.pageNumber,
      section: res.entry.section,
      metadata: res.entry.metadata,
      retrievalScore: res.similarityScore,
      relevanceScore: undefined, // Untouched by retriever
      decision: "pending", // Pending relevance evaluation
      rank: res.rank,
    }));

    // 5. Construct immutable CandidateChunkPool
    const pool: CandidateChunkPool = {
      id: `pool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      query: trimmedQuery,
      retrievedAt: Date.now(),
      candidateChunks,
      totalCandidates: candidateChunks.length,
      retrievalConfig: {
        topK,
        similarityThreshold,
        embeddingModel: this.embeddingProvider.model,
      },
      embeddingModel: this.embeddingProvider.model,
      retrievalLatencyMs: Number(elapsedMs.toFixed(2)),
      documentId,
    };

    // 6. Lifecycle event: Retrieval completed
    if (this.observerSubject) {
      this.observerSubject.notifyObservers({
        type: "phase:completed",
        event: {
          id: `evt_ret_done_${Date.now()}`,
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "chunks_retrieved",
          label: `Retrieved ${candidateChunks.length} candidate passages`,
          status: "success",
          durationMs: elapsedMs,
          details: { count: candidateChunks.length, topScore: candidateChunks[0]?.retrievalScore },
        },
      });
    }

    return pool;
  }
}
