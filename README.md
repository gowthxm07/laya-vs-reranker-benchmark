# PatternRAG Lab — Laya vs Advanced RAG Benchmark

> **Phase 2: Common Document Ingestion, Chunking, Embedding & Vector Retrieval Foundation**  
> *Note: Phase 2 implements the real, local document-to-vector retrieval pipeline producing the shared `CandidateChunkPool`. Post-retrieval relevance evaluation (Cross-Encoder in Phase 3, Laya in Phase 4) and generation (Ollama `llama3.2:3b` in Phase 5) are connected incrementally.*

[![Phase 2](https://img.shields.io/badge/Status-Phase%202%20Retrieval%20Foundation-blue.svg)](#current-phase-2-status)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Embeddings](https://img.shields.io/badge/Ollama-nomic--embed--text-green.svg)](https://ollama.com/)

---

## 1. What is PatternRAG Lab?

**PatternRAG Lab** is an experimental evaluation platform designed to systematically benchmark and contrast post-retrieval relevance strategies on identical RAG workloads.

When a query is submitted to a retrieval system, standard vector searches often retrieve a mixture of genuinely useful passages and off-topic or noisy chunks. How a system filters or re-ranks those candidate passages before feeding them to an LLM directly determines answer accuracy, token cost, and latency.

PatternRAG Lab is also a **Software Design Patterns** showcase: the architecture is explicitly built around modular, decoupled contracts so that relevance evaluation strategies, LLM providers, and storage backends can be swapped without modifying core application logic.

---

## 2. Why Compare Advanced RAG and Laya?

Standard RAG architectures frequently rely on one of two paradigms post-retrieval:

- **Path A — Advanced RAG (Cross-Encoder / Reranker)**:
  `Candidate Chunks → Joint Cross-Attention Scoring → Top-K Retained Chunks → LLM → Answer`
- **Path B — Laya RAG (Laya Relevance Evaluator)**:
  `Candidate Chunks → Laya Semantic Pruning/Filtering → Retained Chunks → LLM → Answer`

### The Fair Comparison Principle
To ensure scientific validity, both paths evaluate the **exact same candidate chunk pool** (`CandidateChunkPool`) for every query and feed their filtered context to the **same downstream LLM configuration** (local `llama3.2:3b` via Ollama). This isolates the post-retrieval relevance evaluator as the sole independent variable.

---

## 3. System Architecture & Data Flow

```
                                      User Query
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │   Document Ingestion  │ (PDF / TXT / MD)
                                │        Pipeline       │
                                └──────────┬────────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │ Deterministic Chunker │ (Stable IDs & Pages)
                                └──────────┬────────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │ Local Vector Store    │ (Ollama Embeddings)
                                └──────────┬────────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │  Shared Retriever     │
                                └──────────┬────────────┘
                                           │
                                           ▼
                             [Shared Candidate Chunk Pool]
                                 (CandidateChunkPool)
                                    │             │
                ┌───────────────────┘             └───────────────────┐
                ▼                                                     ▼
     ┌──────────────────────┐                              ┌──────────────────────┐
     │  Phase 3: Adv RAG    │                              │  Phase 4: Laya RAG   │
     │    Cross-Encoder     │                              │    Laya Evaluator    │
     │       Reranker       │                              │  Relevance Filtering │
     └──────────┬───────────┘                              └──────────┬───────────┘
                │                                                     │
                ▼                                                     ▼
        [Retained Chunks]                                     [Retained Chunks]
                │                                                     │
                └───────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ Downstream LLM Engine │ (llama3.2:3b local)
                        │ & Head-to-Head Trace  │
                        └───────────────────────┘
```

Detailed architectural diagrams and retrieval specifications are documented in:
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/RETRIEVAL.md`](docs/RETRIEVAL.md)
- [`docs/DESIGN_PATTERNS.md`](docs/DESIGN_PATTERNS.md)

---

## 4. Current Phase 2 Capabilities

Phase 2 establishes the end-to-end local document retrieval foundation:

- **Multi-Format Document Parsing**:
  - PDF parser (`PdfDocumentParser`) preserving page numbers and boundaries.
  - Plain text (`TextDocumentParser`) and Markdown (`MarkdownDocumentParser`).
  - Pluggable `DocumentParserFactory`.
- **Deterministic Chunking (`DeterministicChunker`)**:
  - Configurable character size (`CHUNK_SIZE = 500`) and overlap (`CHUNK_OVERLAP = 100`).
  - Word-boundary aware segmentation.
  - Stable IDs: `${documentId}_p${pageNumber}_c${chunkIndex}`.
- **Local Embedding Provider (`OllamaEmbeddingProvider`)**:
  - Powered by Ollama `nomic-embed-text` (768 dimensions).
  - Offline `MockEmbeddingProvider` for deterministic unit testing.
- **Persistent Local Vector Index (`LocalVectorStore`)**:
  - In-memory cosine similarity search with atomic JSON persistence (`data/vector-store.json`).
  - Zero native C++ compilation dependencies.
- **Shared Candidate Chunk Pool (`CandidateChunkPool`)**:
  - Produces immutable candidate pools with cosine similarity scores and initial ranks.
  - Strictly preserves `decision: "pending"`, leaving post-retrieval relevance evaluation to future strategies.
- **Server API Routes**:
  - `POST /api/documents/ingest`: Multipart file upload or text payload ingestion.
  - `GET /api/documents` & `DELETE /api/documents`: Vector index management.
  - `POST /api/retrieve`: Semantic Top-K retrieval producing `CandidateChunkPool`.
- **UI Shell Extensions**:
  - `DocumentIngestionCard`: Drag-and-drop file upload, indexing stats, and duration counters.
  - `CandidatePoolInspector`: Real-time inspection of retrieved candidate passages with full text expansion.

---

## 5. Software Design Patterns

PatternRAG Lab applies six classical software design patterns:

1. **Strategy Pattern** (`src/lib/patterns/strategy/`):
   Defines `RelevanceEvaluator` interface for post-retrieval algorithms (`CrossEncoderEvaluator`, `LayaEvaluator`, `SimilarityThresholdEvaluator`).
2. **Adapter Pattern** (`src/lib/patterns/adapter/`):
   `ILayaAdapter` decouples core models from external Laya API specifications.
3. **Factory Pattern** (`src/lib/patterns/factory/` & `src/lib/parsers/`):
   `DocumentParserFactory`, `EmbeddingProviderFactory`, `EvaluatorFactory`, and `LLMProviderFactory`.
4. **Facade Pattern** (`src/lib/patterns/facade/`):
   `RAGOrchestratorFacade` provides unified orchestration.
5. **Builder Pattern** (`src/lib/patterns/builder/`):
   `ContextBuilder` and `PromptBuilder` provide fluent prompt construction and token-budget limits.
6. **Observer Pattern** (`src/lib/patterns/observer/`):
   `ObservablePipelineSubject` and `TraceRecorderObserver` record phase durations and decision audits.

---

## 6. Project Roadmap (8 Phases)

- **Phase 1**: Project Foundation & Architecture (Done)
- **Phase 2**: Common Document Retrieval Foundation (Done)
- **Phase 3**: Advanced RAG / Cross-Encoder Relevance Evaluation
- **Phase 4**: Laya Relevance Evaluation
- **Phase 5**: Shared Execution + Comparison Engine (Ollama `llama3.2:3b`)
- **Phase 6**: Evaluation Metrics & Benchmark Suite
- **Phase 7**: Dashboard, Trace & History Refinement
- **Phase 8**: Final Testing, Documentation & Demonstration

Track the full roadmap in [`docs/PHASES.md`](docs/PHASES.md).

---

## 7. Local Development Setup

### Prerequisites
- Node.js `v20+` or `v22+` (v22.19.0 recommended)
- npm `10+` or `11+`
- Ollama with `nomic-embed-text` model:
  ```bash
  ollama pull nomic-embed-text
  ```

### Installation
```bash
# Clone the repository
git clone https://github.com/gowthxm07/laya-vs-reranker-benchmark.git
cd laya-vs-reranker-benchmark

# Install dependencies
npm install
```

---

## 8. Environment Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### Configuration Variables
```env
# Local Embedding Provider
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

# Vector Storage Path
VECTOR_STORE_PATH=./data/vector-store.json

# Chunking Configuration (characters)
CHUNK_SIZE=500
CHUNK_OVERLAP=100
TOP_K=10

# Downstream Model (Phase 5)
OLLAMA_MODEL=llama3.2:3b
```

---

## 9. Running the Application

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Type Checking & Testing
```bash
# Run TypeScript compilation check
npm run type-check

# Run automated test suite
npm test

# Run code linter
npm run lint

# Verify local Ollama integration
npx tsx scripts/test-local-integration.mjs
```

### Production Build
```bash
npm run build
npm start
```

---

## License

This project is licensed under the MIT License.
