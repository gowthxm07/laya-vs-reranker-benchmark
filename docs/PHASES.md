# PatternRAG Lab — Project Roadmap & Phases

This roadmap tracks the progressive implementation of PatternRAG Lab across its 8 planned phases.

---

## Phase Matrix

| Phase | Title | Focus Area | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Project Foundation & Architecture** | Project setup, design system, core domain models, design pattern contracts, initial UI shell, documentation | **Completed** |
| **Phase 2** | **Common Document Retrieval Foundation** | PDF/TXT/MD ingestion, page preservation, deterministic chunking, Ollama embeddings, local vector index, shared `CandidateChunkPool` | **Completed** |
| **Phase 3** | **Advanced RAG / Cross-Encoder Relevance Evaluation** | Cross-Encoder model loading (`cross-encoder/ms-marco-MiniLM-L-6-v2`), persistent Python worker IPC, candidate re-scoring, Top-N selection, rank shift tracking | **Completed** |
| **Phase 4** | **Laya Relevance Evaluation** | Laya adapter integration, `D:\laya` runtime validation, non-autoregressive System 1 decision heads, persistent worker IPC, KEEP/DROP gating, context reduction calculation | **Completed** |
| **Phase 5** | **Shared Execution + Comparison Engine** | Downstream generation (Ollama `llama3.2:3b`), dual-pipeline orchestrator facade, side-by-side execution | Planned |
| **Phase 6** | **Evaluation Metrics & Benchmark Suite** | Faithfulness scoring, context reduction rates, differential latency/token analysis, batch query suite | Planned |
| **Phase 7** | **Dashboard, Trace & History Refinement** | Observer decision trace visualization, historical experiment storage, comparative analytics | Planned |
| **Phase 8** | **Final Testing, Documentation & Demonstration** | End-to-end integration verification, comprehensive user guides, research benchmark reports | Planned |

---

## Detailed Milestone Records

### Phase 1 — Project Foundation & Architecture (Completed)
- [x] Initialized Next.js 14 App Router project with TypeScript and Tailwind CSS.
- [x] Established restrained, developer-tool design system and CSS tokens (Linear/Raycast aesthetic, zero unnecessary gradients).
- [x] Defined TypeScript core domain models: `Chunk`, `TraceEvent`, `PipelineResult`, `Experiment`, `EvaluationMetrics`.
- [x] Implemented core Software Design Pattern contracts:
  - Strategy Pattern (`RelevanceEvaluator`)
  - Adapter Pattern (`ILayaAdapter`)
  - Factory Pattern (`EvaluatorFactory`, `LLMProviderFactory`)
  - Facade Pattern (`RAGOrchestratorFacade`)
  - Builder Pattern (`ContextBuilder`, `PromptBuilder`)
  - Observer Pattern (`ObservablePipelineSubject`, `TraceRecorderObserver`)
- [x] Built initial application UI shell with side-by-side comparison workspace and Design Patterns Inspector modal.
- [x] Automated unit test suite with Vitest (11 tests passed).
- [x] Git commit and verified push to GitHub (`508e09e`).

---

### Phase 2 — Common Document Retrieval Foundation (Completed)
- [x] Implemented document parser abstraction (`DocumentParser`) and factory (`DocumentParserFactory`).
- [x] Built `PdfDocumentParser` preserving exact page boundaries and page numbers using `pdf-parse`.
- [x] Built `TextDocumentParser` and `MarkdownDocumentParser`.
- [x] Implemented `DeterministicChunker` with configurable chunk size (default 500 chars), overlap (default 100 chars), word-boundary awareness, and stable IDs (`${documentId}_p${pageNumber}_c${chunkIndex}`).
- [x] Integrated local Ollama embedding provider (`OllamaEmbeddingProvider`) targeting `nomic-embed-text` (768 dimensions).
- [x] Implemented `MockEmbeddingProvider` for fast, offline, deterministic unit testing.
- [x] Built `LocalVectorStore` with cosine similarity, zero native dependencies, and atomic JSON persistence (`data/vector-store.json`).
- [x] Implemented `SharedRetrieverService` producing the un-reranked `CandidateChunkPool`.
- [x] Enforced experimental control: Retriever marks chunks as `decision: "pending"`, leaving post-retrieval relevance evaluation to future strategies.
- [x] Created server API routes: `POST /api/documents/ingest`, `GET/DELETE /api/documents`, `POST /api/retrieve`.
- [x] Extended UI with `DocumentIngestionCard`, Top-K retrieval controls, and `CandidatePoolInspector` with full-text expansion.
- [x] Added comprehensive unit tests in `src/__tests__/retrieval.test.ts` (total 23 tests across test suites).
- [x] Verified real local Ollama end-to-end integration via `scripts/test-local-integration.mjs`.
- [x] Added detailed retrieval architecture documentation (`docs/RETRIEVAL.md`).

---

### Phase 3 — Advanced RAG / Cross-Encoder Relevance Evaluation (Completed)
- [x] Implemented persistent Python Cross-Encoder worker (`scripts/cross_encoder_worker.py`) using `sentence-transformers` and `cross-encoder/ms-marco-MiniLM-L-6-v2`.
- [x] Implemented `PythonCrossEncoderProvider` communicating via line-delimited JSON IPC over stdin/stdout, eliminating per-query model reload overhead (warm batch scoring in ~70–150ms).
- [x] Implemented `MockCrossEncoderProvider` for deterministic, zero-dependency offline testing.
- [x] Built `CrossEncoderProviderFactory` enabling runtime provider resolution and mock injection.
- [x] Implemented `CrossEncoderRerankingService` and `CrossEncoderEvaluator` Strategy, preserving the shared `CandidateChunkPool` without secondary retrieval.
- [x] Engineered Top-N selection logic, assigning `retained` status to the top $N$ candidates and `discarded` to remainder.
- [x] Computed rank shifts (`rankDelta = originalRank - rerankedRank`) to track movements between bi-encoder and cross-encoder stages.
- [x] Created `POST /api/rerank` endpoint accepting `{ candidatePool, topN }`.
- [x] Created `RerankedPoolInspector` UI component with rank delta badges, score transitions, and full passage inspection.
- [x] Updated `CandidatePoolInspector` with Top-N selector and "Run Cross-Encoder Rerank (Path A)" trigger.
- [x] Added 12 comprehensive unit tests in `src/__tests__/reranking.test.ts` (total 35 tests passing across all test suites).
- [x] Added detailed architectural guide in `docs/RERANKING.md`.

---

### Phase 4 — Laya Relevance Evaluation (Completed)
- [x] Validated real local Laya checkpoint (`D:\laya`) and `laya 0.3.20` runtime.
- [x] Built persistent Python Laya worker (`scripts/laya_worker.py`) communicating via line-delimited JSON IPC over stdin/stdout.
- [x] Formulated typed binary choice question contract (`keep` vs `drop`) with calibrated probabilities and confidence metrics.
- [x] Implemented `PythonLayaProvider` with process lifecycle management and cold-start tracking.
- [x] Implemented `MockLayaProvider` for deterministic, zero-dependency unit tests.
- [x] Implemented `LayaProviderFactory` for runtime provider resolution and mock injection.
- [x] Implemented `LayaAdapter` adapting domain chunks to Laya format, validating decisions, and attaching calibrated probabilities.
- [x] Implemented `LayaEvaluator` Strategy implementing `RelevanceEvaluator`.
- [x] Implemented `LayaRelevanceFilteringService` coordinating candidate evaluation, candidate lineage preservation, and context reduction calculation.
- [x] Created `POST /api/laya/evaluate` API endpoint accepting `{ candidatePool }`.
- [x] Created `LayaFilteredPoolInspector` UI component displaying KEEP/DROP badges, probabilities, and passage inspection.
- [x] Updated `CandidatePoolInspector` with "Run Laya Filter (Path B)" trigger button.
- [x] Connected Path B in `ComparisonWorkspace` with real retained/discarded chunks, latency diagnostics, and decision traces.
- [x] Added 12 comprehensive unit tests in `src/__tests__/laya.test.ts` (total 47 tests passing across all project suites).
- [x] Verified real local Laya integration test (`scripts/test-laya-integration.py`) against `D:\laya`.
- [x] Created comprehensive documentation in `docs/LAYA.md`.

---

### Phase 5 — Shared Execution + Comparison Engine (Completed)
- [x] Implemented `LLMProvider` contract with `OllamaLLMProvider` targeting local `llama3.2:3b` at `http://localhost:11434/api/generate`.
- [x] Implemented `MockLLMProvider` capturing prompt/parameter history and simulating errors for hermetic unit testing.
- [x] Implemented `LLMProviderFactory` with runtime model configuration via `LLM_PROVIDER` and `OLLAMA_LLM_MODEL`.
- [x] Created shared prompt template in `PromptBuilder.createBenchmarkPrompt()` enforcing prompt parity.
- [x] Created standardized context assembly in `ContextBuilder.createBenchmarkBuilder()` omitting score leakage.
- [x] Implemented `RAGComparisonOrchestrator` coordinating controlled side-by-side benchmark runs on the SAME candidate pool and LLM.
- [x] Implemented Mode A (Native Strategy Mode) and Mode B (Context-Budget Mode) with deterministic Laya over-budget policy.
- [x] Implemented strict empty-context policy generating explicit insufficient-evidence answers without fallback chunks.
- [x] Created `POST /api/compare` API route accepting `{ query, candidatePool, mode, topN, maxContextChunks }`.
- [x] Upgraded `ComparisonWorkspace` with mode selectors, budget inputs, latency/token summaries, and `ContextViewerModal`.
- [x] Added 16 deterministic unit tests in `src/__tests__/comparison.test.ts` (total 63 tests passing across 5 project suites).
- [x] Verified live local integration test (`scripts/test-comparison-integration.ts`) running Cross-Encoder, Laya (`D:\laya`), and Ollama (`llama3.2:3b`).
- [x] Created comprehensive documentation in `docs/COMPARISON.md`.

---

### Phase 6 — Evaluation Metrics & Benchmark Suite (Planned)
- Implement objective evaluation metrics: Answer faithfulness, answer relevance, context reduction efficiency.
- Measure context precision, recall, and hallucination rates.
- Implement automated benchmark runner across curated query collections.
- Establish empirical head-to-head comparison without premature bias.

---

### Phase 7 — Dashboard, Trace & History Refinement (Planned)
- Interactive decision trace timeline showing per-step latencies.
- Historical experiment persistence and comparison browser.

---

### Phase 8 — Final Testing, Documentation & Demonstration (Planned)
- End-to-end test validation across diverse document collections.
- Final research report and demonstration artifacts.
