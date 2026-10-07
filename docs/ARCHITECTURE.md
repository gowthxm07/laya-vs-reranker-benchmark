# PatternRAG Lab — System Architecture

## 1. Overview & Objective

**PatternRAG Lab** is an experimental evaluation platform designed to systematically benchmark post-retrieval relevance strategies on identical retrieval workloads while adhering to classical software design patterns.

Modern Retrieval-Augmented Generation (RAG) pipelines often suffer from context noise: bi-encoder vector similarity searches frequently retrieve passages that contain surface-level keyword or lexical overlap but lack genuine semantic utility for answering the query. This project isolates and compares two distinct post-retrieval relevance approaches:

- **Path A — Advanced RAG (Cross-Encoder / Reranker)**: Joint cross-attention transformer scoring of `(query, candidate_chunk)` pairs to prioritize passages with high semantic relevance.
- **Path B — Laya RAG (Laya Relevance Evaluator)**: Post-retrieval relevance evaluation and semantic pruning using Laya's engine.

```
                                      User Query
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │   RAG Orchestrator    │  (Facade Pattern)
                                │        Facade         │
                                └──────────┬────────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │   Document Retriever  │  (SharedRetrieverService)
                                └──────────┬────────────┘
                                           │
                                           ▼
                           [Shared Candidate Chunks Pool]
                               (CandidateChunkPool)
                                    │             │
                ┌───────────────────┘             └───────────────────┐
                ▼                                                     ▼
     ┌──────────────────────┐                              ┌──────────────────────┐
     │     PATH A: RAG      │                              │     PATH B: LAYA     │
     │    Cross-Encoder     │ (Strategy)                   │    Laya Evaluator    │ (Strategy + Adapter)
     │       Reranker       │                              │  Relevance Filtering │
     └──────────┬───────────┘                              └──────────┬───────────┘
                │                                                     │
                ▼                                                     ▼
        [Retained Chunks]                                     [Retained Chunks]
                │                                                     │
                ▼                                                     ▼
     ┌──────────────────────┐                              ┌──────────────────────┐
     │ Context & Prompt     │ (Builder)                    │ Context & Prompt     │ (Builder)
     │     Assembler        │                              │     Assembler        │
     └──────────┬───────────┘                              └──────────┬───────────┘
                │                                                     │
                ▼                                                     ▼
     ┌──────────────────────┐                              ┌──────────────────────┐
     │  Downstream Model    │ (LLMProvider                 │  Downstream Model    │ (LLMProvider
     │    llama3.2:3b       │  Contract)                   │    llama3.2:3b       │  Contract)
     └──────────┬───────────┘                              └──────────┬───────────┘
                │                                                     │
                ▼                                                     ▼
        [Path A Answer]                                       [Path B Answer]
                │                                                     │
                └───────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ Comparative Analytics │  (Observer Pattern)
                        │ & Head-to-Head Trace  │
                        └───────────────────────┘
```

---

## 2. Controlled Fair Comparison Guarantee

To establish scientific validity, PatternRAG Lab isolates **only** the post-retrieval relevance mechanism:

1. **Identical Candidate Pool**: Both Path A and Path B receive the exact same initial candidates from the vector retriever (`CandidateChunkPool`). Neither pipeline benefits from different retrieval Top-K, disparate embedding models, or different vector indexes.
2. **Identical Generation Configuration**: Both pipelines synthesize prompts using standardized context templates (`PromptBuilder`, `ContextBuilder`) and feed the resulting context to the exact same downstream generation configuration (local `llama3.2:3b` via Ollama).
3. **Differential Metrics**: The system measures isolated latency, token consumption, context reduction rate, and answer quality.

---

## 3. Subsystem Architecture

### 3.1 Document Ingestion & Parsers (`src/lib/parsers/`)
- Multi-format ingestion: PDF, TXT, Markdown.
- `PdfDocumentParser` extracts text using `pdf-parse` while preserving exact page boundaries and page numbers.
- `DocumentParserFactory` decouples parsing invocation from file extensions.

### 3.2 Deterministic Chunking (`src/lib/chunking/`)
- `DeterministicChunker` segments text into sliding windows with configurable character size (default: 500) and overlap (default: 100).
- Chunks never cross page boundaries without page attribution.
- Produces stable, deterministic chunk IDs: `${documentId}_p${pageNumber}_c${chunkIndex}`.

### 3.3 Embeddings & Local Vector Index (`src/lib/vector-store/` & `src/lib/providers/`)
- **Embedding Provider**: `OllamaEmbeddingProvider` using local `nomic-embed-text` (768 dimensions).
- **Vector Storage**: `LocalVectorStore` performs cosine similarity search with zero native compilation dependencies and atomic JSON persistence (`data/vector-store.json`).

### 3.4 Shared Retriever (`src/server/services/retriever-service.ts`)
- Implements `IRetriever`.
- Embeds queries and executes Top-K similarity searches.
- Packages results into an immutable `CandidateChunkPool`.
- **Strict Boundary**: The retriever marks all chunks as `decision: "pending"` and leaves post-retrieval relevance evaluation entirely to future strategies.

### 3.5 Relevance Evaluator Strategy (`RelevanceEvaluator`)
The primary polymorphic boundary (Strategy pattern):
- **Path A (Completed in Phase 3)**: `CrossEncoderEvaluator` calculates joint cross-attention scores via `cross-encoder/ms-marco-MiniLM-L-6-v2`. Managed by `CrossEncoderRerankingService` and `PythonCrossEncoderProvider` over a persistent Python worker IPC channel, sorting candidates and retaining Top-N chunks.
- **Path B (Completed in Phase 4)**: `LayaEvaluator` communicates via `LayaAdapter` and `PythonLayaProvider` (`D:\laya`) to evaluate passages using non-autoregressive System 1 decisions, assigning calibrated KEEP/DROP decisions and pruning candidate context without secondary retrieval.

### 3.6 Context & Prompt Builders (`IContextBuilder`, `IPromptBuilder`)
Encapsulates token budget limits, header labeling, and system prompt constraints. Ensures prompts are synthesized identically across both pipelines without leaking implementation specifics.

### 3.7 LLM Provider (`LLMProvider`)
Interchangeable generation layer:
- **Primary (Phase 5 Completed)**: `OllamaLLMProvider` targeting local `llama3.2:3b` at `http://localhost:11434/api/generate` with zero temperature and fixed seed (42).
- **Mock Testing Provider**: `MockLLMProvider` ensuring hermetic deterministic unit test suites.
- **Provider Factory**: `LLMProviderFactory` selects provider based on `LLM_PROVIDER` environment variable.

### 3.8 Comparison Orchestrator (`RAGComparisonOrchestrator`)
- Coordinates fair, controlled side-by-side benchmark runs.
- Consumes identical `CandidateChunkPool`.
- Evaluates Native Strategy Mode vs Context-Budget Mode.
- Builds context with shared `ContextBuilder` and generates answers sequentially on the SAME local `llama3.2:3b`.
- Captures independent relevance, context building, and LLM generation latencies.

### 3.9 Telemetry & Trace Observer (`IPipelineObserver`)
Listens to pipeline lifecycle events without polluting core evaluation routines. Captures phase durations (`TraceEvent`), chunk decision audits, and token counters.

---

## 4. Documentation References
- Controlled LLM Comparison: [`docs/COMPARISON.md`](COMPARISON.md)
- Laya Relevance Evaluation: [`docs/LAYA.md`](LAYA.md)
- Cross-Encoder Reranking: [`docs/RERANKING.md`](RERANKING.md)
- Retrieval Architecture: [`docs/RETRIEVAL.md`](RETRIEVAL.md)
- Design Patterns: [`docs/DESIGN_PATTERNS.md`](DESIGN_PATTERNS.md)
- Implementation Roadmap: [`docs/PHASES.md`](PHASES.md)
