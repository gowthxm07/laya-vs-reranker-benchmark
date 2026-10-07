# PatternRAG Lab — Laya vs Advanced RAG Benchmark

> **Phase 1: Project Foundation & Architecture**  
> *Note: Phase 1 establishes the architectural contracts, design system, models, design patterns, and UI shell. Downstream RAG execution, vector indexing, cross-encoders, and Laya service calls will be integrated incrementally in subsequent phases.*

[![Phase 1](https://img.shields.io/badge/Status-Phase%201%20Foundation-blue.svg)](#current-phase-1-status)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)

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
To ensure scientific validity, both paths evaluate the **exact same candidate chunk pool** for every query and feed their filtered context to the **same downstream LLM configuration** (local `llama3.2:3b` via Ollama). This isolates the post-retrieval relevance evaluator as the sole independent variable.

---

## 3. Eventual System Architecture

```
User Query
    ↓
RAG Orchestrator / Facade
    ↓
Document Retriever
    ↓
Shared Candidate Chunks Pool
    ├─────────────────────────────────────────┐
    ▼                                         ▼
Path A: Cross-Encoder Reranker           Path B: Laya Relevance Filter
    ↓                                         ↓
Retained Chunks Context                  Retained Chunks Context
    ↓                                         ↓
LLM Answer Generator (llama3.2:3b)       LLM Answer Generator (llama3.2:3b)
    ↓                                         ↓
Path A Answer                            Path B Answer
    └────────────────────┬────────────────────┘
                         ↓
             Differential Benchmark Metrics & Trace
```

Detailed architectural diagrams and subsystem boundaries are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 4. Software Design Patterns

PatternRAG Lab applies six classical software design patterns:

1. **Strategy Pattern** (`src/lib/patterns/strategy/`):
   Defines the `RelevanceEvaluator` interface for interchangeable post-retrieval algorithms (`CrossEncoderEvaluator`, `LayaEvaluator`, `SimilarityThresholdEvaluator`).
2. **Adapter Pattern** (`src/lib/patterns/adapter/`):
   Defines `ILayaAdapter` and `LayaAdapter` to decouple the core application from external Laya API specifications.
3. **Factory Pattern** (`src/lib/patterns/factory/`):
   `EvaluatorFactory` and `LLMProviderFactory` dynamically instantiate evaluators and model providers by key.
4. **Facade Pattern** (`src/lib/patterns/facade/`):
   `RAGOrchestratorFacade` provides a unified orchestration boundary (`executePipeline()`) concealing retrieval, filtering, and synthesis details.
5. **Builder Pattern** (`src/lib/patterns/builder/`):
   `ContextBuilder` and `PromptBuilder` provide fluent, deterministic prompt construction and token-budget enforcement.
6. **Observer Pattern** (`src/lib/patterns/observer/`):
   `ObservablePipelineSubject` and `TraceRecorderObserver` record phase durations and decision audits without side-effects.

Comprehensive pattern documentation is available in [`docs/DESIGN_PATTERNS.md`](docs/DESIGN_PATTERNS.md).

---

## 5. Current Phase 1 Status

Phase 1 establishes the project foundation:

- **Clean Design System**: Restrained, typography-driven technical interface (Linear/Raycast inspired) with CSS tokens, subtle 1px borders, and zero gratuitous gradients.
- **Side-by-Side UI Shell**: Interactive comparison workspace with dataset selector, query input, side-by-side columns, and empty metrics state.
- **Zero Fake Data**: Unexecuted pipelines clearly display authentic empty states (`Not run`, `Waiting for query`, `—`) rather than mocked benchmark numbers.
- **Complete Domain Models**: `Chunk`, `TraceEvent`, `PipelineResult`, `Experiment`, and `EvaluationMetrics` typed in TypeScript.
- **Design Pattern Implementations**: Strategy, Adapter, Factory, Facade, Builder, and Observer contracts fully implemented with unit test coverage.
- **LLM Abstraction Prepared**: Configured for local `llama3.2:3b` via Ollama with secondary OpenRouter fallback contract.

---

## 6. Future Phases at a Glance

- **Phase 2**: Document ingestion, chunking, vector indexing, and Cross-Encoder re-ranker integration.
- **Phase 3**: Laya API adapter connection and relevance filtering strategy.
- **Phase 4**: Downstream generation via Ollama `llama3.2:3b` and side-by-side comparison execution.
- **Phase 5**: Quantitative benchmark suite, faithfulness scoring, and batch evaluation runs.

Track the full roadmap in [`docs/PHASES.md`](docs/PHASES.md).

---

## 7. Local Development Setup

### Prerequisites
- Node.js `v20+` or `v22+` (v22.19.0 recommended)
- npm `10+` or `11+`
- Git

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
# Local LLM Provider (Target model for fair evaluation)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Optional Remote Provider (Phase 1 does NOT require API keys)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct

# Cross-Encoder Reranker Model
RERANKER_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2

# Laya Service Configuration
LAYA_API_ENDPOINT=http://localhost:8080/v1
LAYA_API_KEY=
```

> **Note**: Phase 1 operates locally without requiring external API keys or remote calls.

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

# Run unit tests
npm test

# Run code linter
npm run lint
```

### Production Build
```bash
npm run build
npm start
```

---

## License

This project is licensed under the MIT License.
