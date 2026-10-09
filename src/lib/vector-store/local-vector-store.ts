import * as fs from "fs/promises";
import * as path from "path";
import {
  IVectorStore,
  VectorEntry,
  VectorSearchResult,
} from "../interfaces/vector-store";

/**
 * Calculates the cosine similarity between two numerical vectors:
 * cos(theta) = (A · B) / (||A|| * ||B||)
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export interface LocalVectorStoreOptions {
  storageFilePath?: string;
  autoSave?: boolean;
}

export interface DocumentSummary {
  documentId: string;
  filename: string;
  chunkCount: number;
  pageCount?: number;
}

/**
 * [LOCAL VECTOR STORE IMPLEMENTATION]
 * Lightweight, zero-native-dependency, persistent vector index for local RAG benchmarking.
 * Stores vectors and chunk metadata with sub-millisecond memory querying and JSON file persistence.
 */
export class LocalVectorStore implements IVectorStore {
  private entries: Map<string, VectorEntry> = new Map();
  private filePath: string;
  private autoSave: boolean;
  private isLoaded: boolean = false;
  private savePromise: Promise<void> | null = null;

  constructor(options?: LocalVectorStoreOptions) {
    this.filePath =
      options?.storageFilePath ||
      process.env.VECTOR_STORE_PATH ||
      path.join(process.cwd(), "data", "vector-store.json");
    this.autoSave = options?.autoSave ?? true;
  }

  /**
   * Ensures vector index is loaded into memory from disk
   */
  public async load(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as VectorEntry[];
      if (Array.isArray(parsed)) {
        this.entries.clear();
        for (const entry of parsed) {
          this.entries.set(entry.id, entry);
        }
      }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code !== "ENOENT") {
        console.error("Failed to load local vector store:", err);
      }
      // If file doesn't exist yet, start with empty store
      this.entries.clear();
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Persists in-memory index to disk
   */
  public async persist(): Promise<void> {
    if (this.savePromise) {
      return this.savePromise;
    }

    this.savePromise = (async () => {
      try {
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });

        const arrayData = Array.from(this.entries.values());
        const tempPath = `${this.filePath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(arrayData, null, 2), "utf-8");
        await fs.rename(tempPath, this.filePath);
      } catch (err) {
        console.error("Failed to persist vector store:", err);
      } finally {
        this.savePromise = null;
      }
    })();

    return this.savePromise;
  }

  async insert(entry: VectorEntry): Promise<void> {
    await this.load();
    this.entries.set(entry.id, entry);
    if (this.autoSave) {
      await this.persist();
    }
  }

  async insertBatch(entries: VectorEntry[]): Promise<void> {
    await this.load();
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
    if (this.autoSave) {
      await this.persist();
    }
  }

  async search(
    queryVector: number[],
    topK: number,
    options?: {
      minScore?: number;
      documentId?: string;
    }
  ): Promise<VectorSearchResult[]> {
    await this.load();

    const scored: Array<{ entry: VectorEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      if (options?.documentId && entry.documentId !== options.documentId) {
        continue;
      }

      const score = calculateCosineSimilarity(queryVector, entry.embedding);

      if (options?.minScore !== undefined && score < options.minScore) {
        continue;
      }

      scored.push({ entry, score });
    }

    // Sort descending by similarity score
    scored.sort((a, b) => b.score - a.score);

    // Slice to Top-K and assign 1-indexed rank
    const results: VectorSearchResult[] = [];
    const limit = Math.min(topK, scored.length);

    for (let i = 0; i < limit; i++) {
      results.push({
        entry: scored[i].entry,
        similarityScore: Number(scored[i].score.toFixed(5)),
        rank: i + 1,
      });
    }

    return results;
  }

  async count(): Promise<number> {
    await this.load();
    return this.entries.size;
  }

  async listDocuments(): Promise<string[]> {
    await this.load();
    const docIds = new Set<string>();
    for (const entry of this.entries.values()) {
      docIds.add(entry.documentId);
    }
    return Array.from(docIds);
  }

  async getIndexedDocumentsSummary(): Promise<DocumentSummary[]> {
    await this.load();
    const map = new Map<
      string,
      { filename: string; chunkCount: number; maxPage?: number }
    >();

    for (const entry of this.entries.values()) {
      const docId = entry.documentId;
      const existing = map.get(docId);
      const filename =
        entry.source ||
        (entry.metadata?.filename as string) ||
        "Document";
      const page = entry.pageNumber;

      if (!existing) {
        map.set(docId, {
          filename,
          chunkCount: 1,
          maxPage: page,
        });
      } else {
        existing.chunkCount += 1;
        if (page && (!existing.maxPage || page > existing.maxPage)) {
          existing.maxPage = page;
        }
      }
    }

    return Array.from(map.entries()).map(([documentId, info]) => ({
      documentId,
      filename: info.filename,
      chunkCount: info.chunkCount,
      pageCount: info.maxPage,
    }));
  }

  async deleteDocument(documentId: string): Promise<number> {
    await this.load();
    let deleted = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (entry.documentId === documentId) {
        this.entries.delete(id);
        deleted++;
      }
    }
    if (deleted > 0 && this.autoSave) {
      await this.persist();
    }
    return deleted;
  }

  async clear(): Promise<void> {
    await this.load();
    this.entries.clear();
    if (this.autoSave) {
      await this.persist();
    }
  }
}

// Global singleton instance for server routes
let globalVectorStore: LocalVectorStore | null = null;

export function getGlobalVectorStore(): LocalVectorStore {
  if (!globalVectorStore) {
    globalVectorStore = new LocalVectorStore();
  }
  return globalVectorStore;
}
