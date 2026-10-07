# PatternRAG Lab — Laya vs Advanced RAG Benchmark

> **Phase 5: Controlled Cross-Encoder vs Laya LLM Comparison**  
> *Note: Phase 5 connects both Path A (Cross-Encoder reranking) and Path B (Laya relevance filtering) to the SAME downstream LLM (`llama3.2:3b` via local Ollama) consuming the exact same shared `CandidateChunkPool`. Both paths execute under identical prompt structures and generation parameters (`temperature: 0, seed: 42`) in two modes: Native Strategy and Context-Budget. Head-to-head metrics, answers, stage latencies, and token budgets are reported objectively without premature winner declaration.*

[![Phase 5](https://img.shields.io/badge/Status-Phase%205%20Controlled%20LLM%20Comparison-success.svg)](#current-phase-5-capabilities)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Embeddings](https://img.shields.io/badge/Ollama-nomic--embed--text-green.svg)](https://ollama.com/)
[![Cross-Encoder](https://img.shields.io/badge/Cross--Encoder-ms--marco--MiniLM--L--6--v2-purple.svg)](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L-6-v2)
[![Laya](https://img.shields.io/badge/Laya-ModernBERT--large%20421M-orange.svg)](docs/LAYA.md)
[![LLM](https://img.shields.io/badge/LLM-llama3.2:3b-blue.svg)](https://ollama.com/)

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
     [Reranked Top-N Pool]                                 [Retained Chunks]
                │                                                     │
                └───────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ Downstream LLM Engine │ (llama3.2:3b local)
                        │ & Head-to-Head Trace  │
                        └───────────────────────┘
```

Detailed architectural diagrams and subsystem guides:
- [`docs/COMPARISON.md`](docs/COMPARISON.md) — Controlled same-LLM comparison, dual modes, prompt isolation, latency & token instrumentation
- [`docs/LAYA.md`](docs/LAYA.md) — Laya non-autoregressive relevance filtering, worker IPC, and calibration
- [`docs/RERANKING.md`](docs/RERANKING.md) — Cross-Encoder joint scoring, logit semantics & Top-N selection
- [`docs/RETRIEVAL.md`](docs/RETRIEVAL.md) — Document parsing, deterministic chunking & vector store
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — High-level system design & component diagrams
- [`docs/DESIGN_PATTERNS.md`](docs/DESIGN_PATTERNS.md) — Software design patterns implementation catalogue
- [`docs/PHASES.md`](docs/PHASES.md) — Progressive project milestone tracker

---

## 4. Current Phase 5 Capabilities

PatternRAG Lab supports both post-retrieval relevance strategies evaluated head-to-head against the same downstream LLM:

### Controlled Same-LLM Comparison Engine (Phase 5)
- **Same Model, Temperature & Seed**:
  - Both Path A and Path B feed their context to the identical local `llama3.2:3b` model via Ollama.
  - Deterministic generation configuration (`temperature: 0, seed: 42`) eliminates variance.
- **Identical Prompt Structure & Zero Leakage**:
  - Context passages are rendered with standard headers (`[Passage N (source, page P)]`) without score leakage, logit leakage, or evaluator branding.
  - Common prompt template with identical instructions across both paths.
- **Dual Comparison Modes**:
  - **Native Strategy Mode**: Each approach retains its natural output (Cross-Encoder Top-N vs Laya `KEEP` classifications).
  - **Context-Budget Mode**: Enforces a strict budget (e.g. 3 chunks max) with deterministic tie-breaking.
- **Exact Stage Latencies & Token Accounting**:
  - Decomposes latency into initial retrieval, relevance evaluation, context building, and LLM inference.
  - Reports exact prompt eval tokens and completion eval tokens directly from Ollama.
- **Empty-Context Safeguard & Modal Context Inspection**:
  - Fallback-free empty-context handling with explicit prompt when zero chunks are retained.
  - Modal context viewer allowing researchers to inspect the exact verbatim text passed to the LLM.
- **Strict Scientific Objectivity**:
  - Zero automated winner declaration or subjective grading.

### Path B — Laya Relevance Filtering (Phase 4)
- **Fast Non-Autoregressive Gating**:
  - Leverages local ModernBERT-large backbone (`D:\laya`, 421M parameters) running System 1 classification.
  - Generates binary `KEEP` or `DROP` decisions per passage in single forward passes without autoregressive generation loops.
- **Calibrated Probabilities & Confidence**:
  - Reports normalized probability distribution (`probabilities: { keep: float, drop: float }`), categorical `confidence`, and `answer_confidence`.
  - Zero fabricated numeric rankings: preserves natural decision boundaries.
- **Persistent Python Worker IPC**:
  - `scripts/laya_worker.py`: Dedicated child worker communicating via line-delimited JSON IPC over stdin/stdout.
  - Keeps model weights warm in VRAM/RAM: cold start is instrumented (~24-27s), while warm batch evaluations execute in ~1.8-2.1s on CPU.
- **Clean Adapter & Provider Pattern**:
  - `LayaProvider` interface with `PythonLayaProvider` and zero-dependency `MockLayaProvider`.
  - `LayaAdapter` (`ILayaAdapter`) maps raw candidate pools to Laya task format and validates strict `keep`/`drop` normalization.
  - `LayaEvaluator` implements the `RelevanceEvaluator` Strategy.
- **API & UI Extensions**:
  - `POST /api/laya/evaluate`: Server endpoint running Laya relevance filtering on candidate pools.
  - `LayaFilteredPoolInspector`: Interactive UI component displaying retained/dropped passages, probability distributions, confidence badges, and token reduction metrics.
  - `CandidatePoolInspector`: Integrated "Run Laya Filter (Path B)" trigger alongside Cross-Encoder.

### Path A — Cross-Encoder Reranking Baseline (Phase 3)
- **Joint Transformer Cross-Attention**:
  - Scores `(query, passage)` pairs simultaneously using `cross-encoder/ms-marco-MiniLM-L-6-v2`.
  - Captures token-level interactions, negations, and semantic relations.
- **Persistent Python Worker IPC**:
  - `scripts/cross_encoder_worker.py`: Dedicated child worker with line-delimited JSON IPC (~70–150ms on CPU warm).
- **Top-N Selection & Rank Shift Tracking**:
  - Computes cross-encoder logits and tracks position shifts (`rankDelta`).
  - Partitions candidates into retained (Top-N) and discarded sets.
- **API & UI Extensions**:
  - `POST /api/rerank`: Server endpoint executing batch reranking.
  - `RerankedPoolInspector`: Interactive UI component displaying rank movements and logit comparisons.

### Shared Retrieval Foundation (Phase 2)
- **Multi-Format Document Parsing**:
  - PDF parser (`PdfDocumentParser`) preserving page numbers and boundaries.
  - Plain text (`TextDocumentParser`) and Markdown (`MarkdownDocumentParser`).
  - Pluggable `DocumentParserFactory`.
- **Deterministic Chunking (`DeterministicChunker`)**:
  - Configurable character size (`CHUNK_SIZE = 500`) and overlap (`CHUNK_OVERLAP = 100`).
  - Word-boundary aware segmentation with stable IDs: `${documentId}_p${pageNumber}_c${chunkIndex}`.
- **Local Embedding Provider (`OllamaEmbeddingProvider`)**:
  - Powered by Ollama `nomic-embed-text` (768 dimensions).
  - Offline `MockEmbeddingProvider` for deterministic unit testing.
- **Persistent Local Vector Index (`LocalVectorStore`)**:
  - In-memory cosine similarity search with atomic JSON persistence (`data/vector-store.json`).
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
- **Phase 3**: Advanced RAG / Cross-Encoder Relevance Evaluation (Done)
- **Phase 4**: Laya Relevance Evaluation (Done)
- **Phase 5**: Same-LLM Controlled Cross-Encoder vs Laya Comparison (Done)
- **Phase 6**: Evaluation Metrics & Benchmark Suite
- **Phase 7**: Dashboard, Trace & History Refinement
- **Phase 8**: Final Testing, Documentation & Demonstration

Track the full roadmap in [`docs/PHASES.md`](docs/PHASES.md).

---

## 7. Local Development Setup

### Prerequisites
- Node.js `v20+` or `v22+` (v22.19.0 recommended)
- npm `10+` or `11+`
- Python `3.10+` with PyTorch, transformers, sentence-transformers, and `laya` (`pip install laya`)
- Ollama with `nomic-embed-text` and `llama3.2:3b` models:
  ```bash
  ollama pull nomic-embed-text
  ollama pull llama3.2:3b
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
# Local Embedding Provider (Phase 2)
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

# Vector Storage Path
VECTOR_STORE_PATH=./data/vector-store.json

# Chunking Configuration (characters)
CHUNK_SIZE=500
CHUNK_OVERLAP=100
TOP_K=10

# Cross-Encoder Reranker (Phase 3 Path A)
CROSS_ENCODER_PROVIDER=python
CROSS_ENCODER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
RERANK_TOP_N=5

# Laya Relevance Evaluator (Phase 4 Path B)
LAYA_PROVIDER=python
LAYA_MODEL_PATH=D:\laya

# Downstream LLM Provider & Comparison (Phase 5)
LLM_PROVIDER=ollama
OLLAMA_LLM_MODEL=llama3.2:3b
COMPARISON_MODE=native
MAX_CONTEXT_BUDGET=3
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

# Run automated test suite (63+ unit tests)
npm test

# Run code linter
npm run lint

# Verify local Ollama integration
npx tsx scripts/test-local-integration.mjs

# Verify local Laya integration
python scripts/test-laya-integration.py

# Verify end-to-end controlled comparison integration
npx tsx scripts/test-comparison-integration.ts
```

### Production Build
```bash
npm run build
npm start
```

---

## License

This project is licensed under the MIT License.
