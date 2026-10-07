# Shared Document Retrieval & Candidate Pool Architecture

## 1. Overview & Purpose

In **PatternRAG Lab**, Phase 2 establishes the common document-to-vector retrieval foundation that feeds both future experimental paths:
- **Path A**: Advanced RAG (Cross-Encoder Reranker)
- **Path B**: Laya RAG (Laya Relevance Evaluator)

Retrieval produces the **Shared Candidate Chunk Pool** (`CandidateChunkPool`). This pool represents the single source of truth for all post-retrieval evaluations, ensuring that the downstream comparison between Cross-Encoders and Laya evaluates **identical passages** with **identical initial ranks and retrieval scores**.

```
                           Raw Document (PDF / TXT / MD)
                                         │
                                         ▼
                            DocumentParserFactory
                                         │
                                         ▼
                          ParsedDocument (Page-attributed)
                                         │
                                         ▼
                               DeterministicChunker
                                         │
                                         ▼
                             Candidate Chunks (Chunk[])
                                         │
                                         ▼
                           EmbeddingProvider (Ollama)
                                         │
                                         ▼
                            Local Vector Store (JSON)
                                         │
                        [User Query: "What attention..."]
                                         │
                                         ▼
                            Query Vectorization (Ollama)
                                         │
                                         ▼
                           Top-K Cosine Similarity Search
                                         │
                                         ▼
                       ┌───────────────────────────────────┐
                       │    SHARED CANDIDATE CHUNK POOL    │
                       │       (CandidateChunkPool)        │
                       └─────────────────┬─────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
        Phase 3: Cross-Encoder                     Phase 4: Laya Evaluator
         Re-Ranking Strategy                         Relevance Filtering
```

---

## 2. Ingestion Pipeline Stages

### 2.1 Document Ingestion & Parsers (`src/lib/parsers/`)
Heterogeneous documents are normalized into standard `ParsedDocument` structures with page tracking:
- **PDF (`PdfDocumentParser`)**: Uses pure-JavaScript `pdf-parse` (v2) to extract text while explicitly maintaining page boundaries and numbers (`pages: [{ pageNumber: 1, text: "..." }]`). Scanned/empty PDFs trigger explicit descriptive errors.
- **TXT (`TextDocumentParser`)**: Extracts UTF-8 plain text with standardized line breaks.
- **Markdown (`MarkdownDocumentParser`)**: Extracts text while retaining Markdown structural sections in metadata.
- **Factory (`DocumentParserFactory`)**: Automatically detects and instantiates the correct parser based on file extensions and MIME headers.

### 2.2 Deterministic Chunking (`src/lib/chunking/chunker.ts`)
The `DeterministicChunker` segments parsed documents using sliding windows with word-boundary awareness:
- **Configuration**:
  - `CHUNK_SIZE`: 500 characters (~125 tokens)
  - `CHUNK_OVERLAP`: 100 characters (~25 tokens)
  - `minChunkSize`: 40 characters
- **Page-Preservation Principle**: Chunking processes each page individually, guaranteeing that no chunk loses its source page provenance.
- **Stable IDs**: Generated deterministically: `${documentId}_p${pageNumber}_c${chunkIndex}`. The same document and configuration always produce identical chunk IDs and contents.

### 2.3 Dense Vector Embeddings (`src/lib/providers/`)
Passage and query embeddings are generated using local transformer representations:
- **Active Model**: `nomic-embed-text` running locally via Ollama (`http://localhost:11434/api/embeddings`).
- **Dimensionality**: 768 continuous dimensions.
- **Offline Mock Provider**: `MockEmbeddingProvider` generates deterministic unit-normalized vectors for fast, isolated CI and unit testing without network or daemon dependencies.

### 2.4 Local Vector Storage (`src/lib/vector-store/`)
Vectors are indexed using `LocalVectorStore`:
- **Implementation**: Pure TypeScript in-memory vector index with asynchronous atomic JSON persistence (`data/vector-store.json`).
- **Rationale**: Zero native C++ compilation dependencies (avoiding Windows build issues), zero cloud database latency, sub-millisecond similarity scans, and persistent across application restarts.
- **Similarity Metric**: Cosine similarity:
  $$\text{cosine\_similarity}(A, B) = \frac{A \cdot B}{\|A\| \|B\|}$$

---

## 3. Query Embedding & Similarity Search

When a query is submitted:
1. The query text is vectorized via `EmbeddingProvider.embedText(query)`.
2. `LocalVectorStore.search(queryVector, topK)` calculates cosine similarity against all indexed entries.
3. Chunks are ranked descending by similarity score.
4. Top-K nearest passages are mapped to `Chunk` entities with:
   - `decision: "pending"`
   - `rank: 1..topK`
   - `retrievalScore: cosine_score`
   - `relevanceScore: undefined`

---

## 4. The Shared Candidate Pool (`CandidateChunkPool`)

The output of retrieval is wrapped into an explicit domain object:
```typescript
export interface CandidateChunkPool {
  id: string;
  query: string;
  retrievedAt: number;
  candidateChunks: Chunk[];
  totalCandidates: number;
  retrievalConfig: RetrievalConfig;
  embeddingModel: string;
  retrievalLatencyMs: number;
}
```

### Why the Candidate Pool is Shared
In many experimental RAG setups, different pipelines are erroneously allowed to perform different retrieval runs (e.g. different Top-K values, different embedding models, or different vector indexes). This introduces confounding variables: when an answer is worse, it is impossible to determine whether the failure was caused by the reranker or the initial retrieval.

By enforcing a **single shared candidate pool**:
1. Both Path A (Cross-Encoder) and Path B (Laya) receive the **identical chunk IDs, texts, sources, and initial scores**.
2. Any difference in retained passages, token consumption, latency, and answer quality is **strictly attributable to the relevance evaluation strategy**.

---

## 5. Why Relevance Evaluation is NOT Part of Retrieval

A core architectural principle of PatternRAG Lab is that **the retriever's responsibility ends at candidate generation**:
- **Retriever Responsibility**: Find Top-K nearest neighbors based on vector embedding distance (`decision: "pending"`).
- **Relevance Evaluator Responsibility (Strategy Pattern)**: Cross-Encoder attention scoring (Phase 3) or Laya semantic pruning (Phase 4).

The retriever **must never prune or filter chunks based on relevance heuristics**. Keeping retrieval strictly separated from relevance evaluation preserves clean separation of concerns and allows interchangeable Strategy patterns to be evaluated fairly.
