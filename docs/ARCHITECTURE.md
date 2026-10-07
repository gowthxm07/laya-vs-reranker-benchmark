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
                                │   Document Retriever  │
                                └──────────┬────────────┘
                                           │
                                           ▼
                           [Shared Candidate Chunks Pool]
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

1. **Identical Candidate Pool**: Both Path A and Path B receive the exact same initial candidates from the vector retriever. Neither pipeline benefits from different retrieval Top-K or disparate chunking.
2. **Identical Generation Configuration**: Both pipelines synthesize prompts using standardized context templates (`PromptBuilder`, `ContextBuilder`) and feed the resulting context to the exact same downstream generation configuration (local `llama3.2:3b` via Ollama).
3. **Differential Metrics**: The system measures isolated latency, token consumption, context reduction rate, and answer quality.

---

## 3. Core Component Boundaries

### 3.1. Document Retriever
Retrieves candidate passages from indexed document collections using dense bi-encoder embeddings or BM25/hybrid search. Outputs a collection of candidate `Chunk` objects with `decision: "pending"`.

### 3.2. Relevance Evaluator Strategy (`RelevanceEvaluator`)
The primary polymorphic boundary. Takes `(query, candidateChunks)` and outputs `retainedChunks`, `discardedChunks`, and `latencyMs`.
- **Path A**: `CrossEncoderEvaluator` calculates joint cross-attention scores and retains Top-K chunks.
- **Path B**: `LayaEvaluator` communicates via `LayaAdapter` to classify passages as relevant or irrelevant.

### 3.3. Context & Prompt Builders (`IContextBuilder`, `IPromptBuilder`)
Encapsulates token budget budgeting, header labeling, and system prompt constraints. Ensures prompts are synthesized identically across both pipelines without leaking implementation specifics.

### 3.4. LLM Provider (`LLMProvider`)
Interchangeable generation layer:
- **Primary**: `OllamaProvider` targeting local `llama3.2:3b`.
- **Secondary**: `OpenRouterProvider` as an optional remote fallback.
Decouples prompt generation from provider-specific SDKs.

### 3.5. Telemetry & Trace Observer (`IPipelineObserver`)
Listens to pipeline lifecycle events without polluting core evaluation routines. Captures phase durations (`TraceEvent`), chunk decision audits, and token counters.

---

## 4. Phase 1 Implementation Status

In **Phase 1**, all component interfaces, models, factories, builders, and observers have been specified in TypeScript with strict typing. Downstream network inference and vector database indexing will be introduced in subsequent phases.
