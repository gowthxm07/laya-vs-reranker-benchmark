# PatternRAG Lab — Project Roadmap & Phases

This roadmap tracks the progressive implementation of PatternRAG Lab across its 8 planned phases.

---

## Phase Matrix

| Phase | Title | Focus Area | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Project Foundation & Architecture** | Project setup, design system, core domain models, design pattern contracts, initial UI shell, documentation | **Completed** |
| **Phase 2** | **Common Document Retrieval Foundation** | PDF/TXT/MD ingestion, page preservation, deterministic chunking, Ollama embeddings, local vector index, shared `CandidateChunkPool` | **Completed** |
| **Phase 3** | **Advanced RAG / Cross-Encoder Relevance Evaluation** | Cross-Encoder model loading (e.g. `cross-encoder/ms-marco-MiniLM-L-6-v2`), candidate re-scoring, Top-K selection | Planned |
| **Phase 4** | **Laya Relevance Evaluation** | Laya adapter integration, semantic relevance filtering strategy, candidate pruning | Planned |
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

### Phase 3 — Advanced RAG / Cross-Encoder Relevance Evaluation (Planned)
- Implement `CrossEncoderEvaluator` strategy.
- Load joint cross-attention scoring model (e.g. `cross-encoder/ms-marco-MiniLM-L-6-v2`).
- Score and re-rank candidate chunks from the shared pool.
- Assign relevance scores and retain Top-K chunks.

---

### Phase 4 — Laya Relevance Evaluation (Planned)
- Connect `LayaAdapter` to the actual Laya relevance service API.
- Implement `LayaEvaluator` strategy invoking `LayaAdapter.filterCandidates()`.
- Validate chunk acceptance/rejection semantics and evaluate pruning rate.

---

### Phase 5 — Shared Execution + Comparison Engine (Planned)
- Connect `OllamaProvider` to local `llama3.2:3b` generation model.
- Implement `RAGOrchestratorFacade.runComparisonBenchmark()`.
- Pass identical candidate pools to both paths, generate answers side-by-side, and record execution trace events.

---

### Phase 6 — Evaluation Metrics & Benchmark Suite (Planned)
- Implement differential metrics: Latency delta, token savings, context reduction rate.
- Implement faithfulness and relevance quality scoring.
- Support automated benchmark execution across query test suites.

---

### Phase 7 — Dashboard, Trace & History Refinement (Planned)
- Interactive decision trace timeline showing per-step latencies.
- Historical experiment persistence and comparison browser.

---

### Phase 8 — Final Testing, Documentation & Demonstration (Planned)
- End-to-end test validation across diverse document collections.
- Final research report and demonstration artifacts.
