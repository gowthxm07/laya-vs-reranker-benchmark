# PatternRAG Lab — Laya vs Advanced RAG Benchmark

> **Phase 8: Finalization, Research Validation & Demo Preparation (COMPLETE)**  
> *PatternRAG Lab is a research-grade evaluation platform benchmarking Non-Autoregressive Relevance Filtering (Laya) against Cross-Encoder Reranking under strict experimental controls. Fully verified with 36 evaluation cases across 9 categories, multi-attribute Pareto tradeoff analysis, live local hardware audits, final research report ([`docs/FINAL_RESULTS.md`](docs/FINAL_RESULTS.md)), and comprehensive presentation guide ([`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md)).*

[![Phase 8](https://img.shields.io/badge/Status-Phase%208%20Finalized%20%26%20Validated-success.svg)](#4-finalized-system-capabilities-phase-8)
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

Detailed architectural diagrams, benchmark findings, and presentation guides:
- [`docs/FINAL_RESULTS.md`](docs/FINAL_RESULTS.md) — **Comprehensive Research Benchmark Report**: empirical findings, Pareto trade-off formalization, category breakdowns & hardware runtime profiles
- [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) — **Complete Demonstration & Presentation Script**: 10-segment walkthrough, live UI demo, failure mode demonstrations & technical Q&A defense
- [`docs/BENCHMARK.md`](docs/BENCHMARK.md) — Objective evaluation methodology, metrics specification, 9 categories, paired differences & Pareto tradeoffs
- [`docs/COMPARISON.md`](docs/COMPARISON.md) — Controlled same-LLM comparison, dual modes, prompt isolation, latency & token instrumentation
- [`docs/LAYA.md`](docs/LAYA.md) — Laya non-autoregressive relevance filtering, worker IPC, and calibration
- [`docs/RERANKING.md`](docs/RERANKING.md) — Cross-Encoder joint scoring, logit semantics & Top-N selection
- [`docs/RETRIEVAL.md`](docs/RETRIEVAL.md) — Document parsing, deterministic chunking & vector store
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — High-level system design & component diagrams
- [`docs/DESIGN_PATTERNS.md`](docs/DESIGN_PATTERNS.md) — Software design patterns implementation catalogue
- [`docs/PHASES.md`](docs/PHASES.md) — Progressive project milestone tracker (Phases 1–8 Completed)

---

## 4. Finalized System Capabilities (Phase 8)

PatternRAG Lab provides an end-to-end evaluation environment for post-retrieval relevance and downstream LLM generation:

### Final Research Validation & Demo Preparation (Phase 8)
- **Empirical Research Findings Report (`docs/FINAL_RESULTS.md`)**: Full 36-case statistical audit across 9 categories, formalizing the multi-attribute Pareto tradeoffs between Cross-Encoder and Laya.
- **Demonstration Script & Presentation Walkthrough (`docs/DEMO_GUIDE.md`)**: Complete 10-segment guide for presenting the laboratory to researchers and stakeholders.
- **Hardware Profile & Execution Audits**: Documented local CPU execution realities (Cross-Encoder: 450–1,950 ms; Laya: 5.6–13.2 s; Ollama llama3.2:3b: 39–45 s) versus GPU scale.
- **Frozen Architecture & Parity Assurance**: Enforced immutable candidate pool preservation, zero score leakage, identical generation prompts and parameters (`temperature=0`, `seed=42`).

### Research Dashboard, UX Refinement & Analysis Audit (Phase 7)
- **Restrained Editorial UI (Kaarya & Claude Code UI inspired)**:
  - High-density, neutral surface styling with subtle borders, cobalt accents, monospace data typography, and zero visual clutter.
- **3-Tier Information Architecture**:
  - `[Interactive RAG Lab]`: Ingestion, vector retrieval, manual triggers, and live side-by-side generation.
  - `[Controlled Benchmark Suite]`: 36-case objective benchmark execution, mode switching, metric groupings, Pareto tradeoffs, and query inspector.
  - `[Run History & Results]`: Direct loading and inspection of persisted runs from `data/benchmark/results/*.json`.
  - Compact horizontal Scientific Protocol summary row (`36 Evaluation Cases · 9 Benchmark Categories · 2 Relevance Strategies (Cross-Encoder vs Laya) · Shared Candidate Pool · Shared LLM (llama3.2:3b)`).
- **3 Conceptual Metric Groups**:
  - **Relevance Quality**: Precision, Recall, F1, Hit Rate, MRR / NDCG (ranking-only; N/A for unordered binary gating).
  - **Context & Computational Efficiency**: Context Reduction %, Token Reduction %, Initial vs Retained Tokens, Latencies (Relevance, Generation, Total).
  - **Downstream Answer Quality**: Fact Coverage, Lexical Groundedness (deterministic token overlap), Refusal Compliance, Reference Similarity.
- **Side-by-Side Chunk Decision Inspector**:
  - `QueryDetailModal` includes a dedicated chunk-level decision alignment table (`Chunk 01: CE [Selected] | Laya [KEEP] | GT [RELEVANT]`), highlighting agreements, false positives, and false negatives with text snippet preview.
- **Run History & CSV/JSON Export**:
  - `GET /api/benchmark/history` lists and serves historical runs.
  - Direct one-click downloads for full JSON runs and spreadsheet CSV reports.
- **Fact Coverage & Grounding Audit**:
  - Enhanced `MockLLMProvider` with deterministic sentence grounding reflecting retained candidate chunks; updated `BenchmarkEvaluator` with multi-token fact coverage.

### Objective Benchmark Suite & Multi-Metric Evaluation (Phase 6)
- **36 Deterministic Benchmark Cases**:
  - Version-controlled dataset spanning 9 benchmark categories: `NORMAL`, `DISTRACTOR_HEAVY`, `MULTI_CHUNK`, `AMBIGUOUS`, `PARTIAL_CONTEXT`, `NO_ANSWER`, `SINGLE_RELEVANT`, `CONFLICTING_CONTEXT`, `LONG_CONTEXT`.
  - Independent ground truth without model-generated labels or circular LLM scoring.
- **Comprehensive Relevance & Efficiency Metrics**:
  - **Relevance Selection**: Precision, Recall, F1, Hit Rate, MRR (ranking only), NDCG (ranking only).
  - **Context & Token Footprint**: Candidate reduction %, Character reduction %, Token reduction %, Token counts.
  - **Answer Quality**: Fact coverage, Exact match, Reference answer similarity, No-Answer refusal compliance, Groundedness.
- **Multi-Dimensional Pareto Tradeoff Analysis**:
  - Replaces arbitrary single-score weighting with Pareto dominance checks across 5 dimensions (F1, Fact Coverage, Context Reduction, Relevance Latency, Total Latency).
- **Paired Differential Statistics**:
  - Tracks query-by-query performance differentials ($CE - Laya$), reporting superior counts and ties.
- **Interactive UI Suite & Per-Query Inspector**:
  - Dedicated benchmark view with KPI strip, aggregate summary table, category-level breakdown, and query inspector modal.
- **Reproducible CLI Runner**:
  - `scripts/run-benchmark.ts`: Standalone execution supporting native/budget modes, repeated runs, and mock verification.

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
- **Phase 6**: Controlled Benchmark & Objective Evaluation (Done)
- **Phase 7**: Research Dashboard, UX Simplification & Analysis Refinement (Done)
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

# Run automated test suite (86+ unit tests)
npm test

# Run code linter
npm run lint

# Verify local Ollama integration
npx tsx scripts/test-local-integration.mjs

# Verify local Laya integration
python scripts/test-laya-integration.py

# Verify end-to-end controlled comparison integration
npx tsx scripts/test-comparison-integration.ts

# Execute controlled benchmark suite with mock providers (0.2s)
npx tsx scripts/run-benchmark.ts --mock

# Execute live controlled benchmark suite (local Cross-Encoder + Laya + Ollama)
npx tsx scripts/run-benchmark.ts
```

### Production Build
```bash
npm run build
npm start
```

---

## License

This project is licensed under the MIT License.
