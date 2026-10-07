# PatternRAG Lab — Project Roadmap & Phases

This roadmap tracks the incremental development of PatternRAG Lab across defined phases.

---

## Phase Summary

| Phase | Title | Focus Area | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Project Foundation & Architecture** | Project setup, design system, core models, design patterns, UI shell, documentation | **Completed** |
| **Phase 2** | **Retrieval & Advanced RAG (Path A)** | Document ingestion, chunking, vector indexing, Cross-Encoder reranker integration | Planned |
| **Phase 3** | **Laya Integration (Path B)** | Laya API adapter, relevance filtering strategy, candidate comparison pipeline | Planned |
| **Phase 4** | **Downstream Generation & Facade** | Ollama (`llama3.2:3b`) local integration, dual-pipeline orchestration, side-by-side run | Planned |
| **Phase 5** | **Evaluation Metrics & Benchmarking** | Faithfulness scoring, latency profiling, dataset evaluation batch runner, exports | Planned |

---

## Detailed Phase Breakdown

### Phase 1 — Project Foundation & Architecture (Current)
- [x] Initialized Next.js App Router project with TypeScript and Tailwind CSS.
- [x] Established restrained, professional design system and CSS tokens (Linear/Raycast aesthetic, zero unnecessary gradients).
- [x] Defined TypeScript models:
  - `Chunk` (retrieval scores, relevance scores, retained/discarded decisions, ranks).
  - `TraceEvent` & `TracePhase` (discrete pipeline lifecycle steps).
  - `PipelineResult` & `Experiment` (comprehensive comparison models).
  - `EvaluationMetrics` & `ComparisonMetrics`.
- [x] Implemented core Software Design Pattern contracts:
  - **Strategy Pattern**: `RelevanceEvaluator` interface and strategy stubs (`CrossEncoderEvaluator`, `LayaEvaluator`).
  - **Adapter Pattern**: `ILayaAdapter` interface and `LayaAdapter` implementation.
  - **Factory Pattern**: `EvaluatorFactory` and `LLMProviderFactory`.
  - **Facade Pattern**: `RAGOrchestratorFacade` coordination boundary.
  - **Builder Pattern**: `ContextBuilder` and `PromptBuilder` for token budgeting and standardized prompts.
  - **Observer Pattern**: `ObservablePipelineSubject` and `TraceRecorderObserver`.
- [x] Built initial application UI shell:
  - Header with status indicators, metadata, and design pattern modal trigger.
  - Benchmark Control Bar with dataset selector and query input.
  - Side-by-side comparison workspace (Advanced RAG vs Laya RAG).
  - Metrics dashboard displaying authentic "Not run / Waiting for query" empty states (zero fake numbers).
  - Interactive Design Patterns Architecture Inspector modal.
- [x] Set up unit testing with Vitest verifying all pattern contracts.
- [x] Created comprehensive documentation (`ARCHITECTURE.md`, `DESIGN_PATTERNS.md`, `PHASES.md`, `README.md`).
- [x] Verified type checking (`tsc --noEmit`), linting (`next lint`), and production build (`next build`).

---

### Phase 2 — Retrieval & Advanced RAG (Path A)
- Implement document parsing and chunking engine.
- Set up local vector storage / embedding index.
- Implement `CrossEncoderEvaluator` using cross-attention re-ranking model (e.g. `cross-encoder/ms-marco-MiniLM-L-6-v2`).
- Verify candidate retrieval and Top-K re-ranking latency on Path A.

---

### Phase 3 — Laya Integration (Path B)
- Connect `LayaAdapter` to the actual Laya relevance service boundary.
- Implement `LayaEvaluator` strategy invoking `LayaAdapter.filterCandidates()`.
- Validate chunk acceptance/rejection semantics and compare filtering behavior against cross-encoder rankings.

---

### Phase 4 — Downstream Generation & Orchestration
- Connect `OllamaProvider` to local `llama3.2:3b` model instance.
- Implement full `RAGOrchestratorFacade.runComparisonBenchmark()` method.
- Pass identical candidate pools to Path A and Path B.
- Synthesize prompt context using `ContextBuilder` and generate comparative answers side-by-side.
- Record real-time trace events through the Observer pattern.

---

### Phase 5 — Metrics, Benchmarking & Evaluation
- Implement automated evaluation metrics:
  - Context reduction rate (%)
  - Latency breakdown (Retrieval vs Relevance vs Generation)
  - Token consumption efficiency
  - Faithfulness / Relevancy (LLM-as-a-judge)
- Support batch evaluation runs across curated query test suites.
- Provide exportable JSON/CSV experiment logs.
