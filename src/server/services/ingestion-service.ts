import { DocumentParserFactory } from "@/lib/parsers/parser-factory";
import { DeterministicChunker, ChunkerOptions } from "@/lib/chunking/chunker";
import { IVectorStore, VectorEntry } from "@/lib/interfaces/vector-store";
import { EmbeddingProvider } from "@/lib/interfaces/embedding-provider";
import { getGlobalVectorStore } from "@/lib/vector-store/local-vector-store";
import { EmbeddingProviderFactory } from "@/lib/providers/embedding-provider-factory";
import { Document } from "@/lib/types/document";
import { IObservablePipeline } from "@/lib/interfaces/observer";

export interface IngestDocumentOptions {
  chunkOptions?: ChunkerOptions;
  metadata?: Record<string, unknown>;
}

export interface IngestionResult {
  document: Document;
  chunkCount: number;
  timings: {
    parseDurationMs: number;
    chunkDurationMs: number;
    embeddingDurationMs: number;
    indexingDurationMs: number;
    totalDurationMs: number;
  };
}

export class DocumentIngestionService {
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

  async ingestDocument(
    buffer: Buffer,
    filename: string,
    mimeType?: string,
    options?: IngestDocumentOptions
  ): Promise<IngestionResult> {
    const totalStart = performance.now();

    // 1. Parsing stage
    const parseStart = performance.now();
    const parser = DocumentParserFactory.getParser(filename, mimeType);
    const parsedDoc = await parser.parse(buffer, filename, {
      metadata: options?.metadata,
    });
    const parseDurationMs = performance.now() - parseStart;

    // 2. Chunking stage
    const chunkStart = performance.now();
    const chunker = new DeterministicChunker(options?.chunkOptions);
    const chunks = chunker.chunkDocument(parsedDoc);
    const chunkDurationMs = performance.now() - chunkStart;

    if (chunks.length === 0) {
      throw new Error(
        `Document "${filename}" resulted in 0 chunks. Ensure the file contains extractable text.`
      );
    }

    // 3. Embedding stage
    const embedStart = performance.now();
    const textsToEmbed = chunks.map((c) => c.text);
    const embeddings = await this.embeddingProvider.embedBatch(textsToEmbed);
    const embeddingDurationMs = performance.now() - embedStart;

    // 4. Indexing stage
    const indexStart = performance.now();
    const vectorEntries: VectorEntry[] = chunks.map((chunk, idx) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      text: chunk.text,
      source: chunk.source,
      pageNumber: chunk.pageNumber,
      section: chunk.section,
      metadata: chunk.metadata,
      embedding: embeddings[idx],
    }));

    await this.vectorStore.insertBatch(vectorEntries);
    const indexingDurationMs = performance.now() - indexStart;

    const totalDurationMs = performance.now() - totalStart;

    const document: Document = {
      id: parsedDoc.documentId,
      filename: parsedDoc.filename,
      mimeType: parsedDoc.mimeType,
      size: buffer.length,
      createdAt: Date.now(),
      pageCount: parsedDoc.pageCount,
      chunkCount: chunks.length,
      metadata: parsedDoc.metadata,
    };

    return {
      document,
      chunkCount: chunks.length,
      timings: {
        parseDurationMs: Number(parseDurationMs.toFixed(2)),
        chunkDurationMs: Number(chunkDurationMs.toFixed(2)),
        embeddingDurationMs: Number(embeddingDurationMs.toFixed(2)),
        indexingDurationMs: Number(indexingDurationMs.toFixed(2)),
        totalDurationMs: Number(totalDurationMs.toFixed(2)),
      },
    };
  }
}
