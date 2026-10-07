# Software Design Patterns in PatternRAG Lab

PatternRAG Lab is developed not only as an AI benchmarking utility but as a rigorous demonstration of classic Gang of Four (GoF) software design patterns applied to modern AI/RAG architectures.

The core motivation is to avoid tight coupling: **Laya is not hardcoded into the application core**, cross-encoder libraries are not intertwined with the UI, and LLM hosts are interchangeable.

---

## Pattern Matrix

| Pattern | Category | Primary Interface / Class | Concrete Implementations | Purpose in PatternRAG Lab |
| :--- | :--- | :--- | :--- | :--- |
| **Strategy** | Behavioral | `RelevanceEvaluator` | `CrossEncoderEvaluator`, `LayaEvaluator`, `SimilarityThresholdEvaluator` | Swap post-retrieval filtering algorithms without modifying orchestration |
| **Adapter** | Structural | `ILayaAdapter` | `LayaAdapter` | Decouple internal `Chunk` models from external Laya API request/response formats |
| **Factory** | Creational | `EvaluatorFactory`, `LLMProviderFactory` | Static creation methods with registry maps | Construct evaluators and LLM providers dynamically by key without hardcoded `new` calls |
| **Facade** | Structural | `IRAGOrchestratorFacade` | `RAGOrchestratorFacade` | Expose a clean, single entrypoint `executePipeline()` concealing retrieval, filtering, and LLM steps |
| **Builder** | Creational | `IContextBuilder`, `IPromptBuilder` | `ContextBuilder`, `PromptBuilder` | Fluently construct prompt payloads and enforce token limits across both pipelines |
| **Observer** | Behavioral | `IPipelineObserver`, `IObservablePipeline` | `ObservablePipelineSubject`, `TraceRecorderObserver` | Collect step-by-step telemetry, latency, and chunk retention audits without side-effects |

---

## 1. Strategy Pattern (`src/lib/patterns/strategy/`)

### Motivation
Both Advanced RAG and Laya RAG operate on the exact same stage of the RAG lifecycle: post-retrieval relevance scoring and pruning. We treat relevance evaluation as an interchangeable algorithm family.

### Contract
```typescript
export interface RelevanceEvaluator {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  evaluateRelevance(
    request: RelevanceEvaluationRequest
  ): Promise<RelevanceEvaluationResult>;
}
```

### Implementations
- `CrossEncoderEvaluator`: Uses joint query-passage cross-attention for deep re-ranking.
- `LayaEvaluator`: Uses Laya's semantic relevance engine to prune low-utility chunks.
- `SimilarityThresholdEvaluator`: Baseline using bi-encoder embedding cosine similarity cutoff.

---

## 2. Adapter Pattern (`src/lib/patterns/adapter/`)

### Motivation
External services like Laya evolve their API structures, authentication requirements, and payload schemas independently. Hardcoding Laya's HTTP contracts directly inside the core application would create tight coupling.

### Contract
```typescript
export interface ILayaAdapter {
  filterCandidates(
    query: string,
    chunks: Chunk[],
    options?: { topK?: number; threshold?: number }
  ): Promise<{
    retainedChunks: Chunk[];
    discardedChunks: Chunk[];
    adapterLatencyMs: number;
    rawResponse?: LayaRawResponse;
  }>;
}
```

### Responsibility
`LayaAdapter` converts domain `Chunk[]` to `LayaRawPayload`, invokes the boundary, and converts `LayaRawResponse` results back into domain `Chunk` objects marked as `retained` or `discarded`.

---

## 3. Factory Pattern (`src/lib/patterns/factory/`)

### Motivation
Neither the user interface nor the orchestration facade should instantiate concrete evaluator classes or LLM providers directly with `new CrossEncoderEvaluator()`.

### Implementation
- `EvaluatorFactory.createEvaluator("cross-encoder" | "laya" | "similarity-threshold")`: returns the requested `RelevanceEvaluator` singleton/instance.
- `LLMProviderFactory.createProvider("ollama" | "openrouter")`: constructs the active `LLMProvider` configured via environment variables.

---

## 4. Facade Pattern (`src/lib/patterns/facade/`)

### Motivation
Executing a RAG pipeline requires coordinating vector retrieval, relevance filtering, context budget assembly, downstream generation, and metrics collection. Exposing these individual subsystems directly to UI components creates high coupling.

### Contract
```typescript
export interface IRAGOrchestratorFacade {
  executePipeline(
    pipelineId: PipelineId,
    query: string,
    dataset: DocumentDataset,
    evaluator: RelevanceEvaluator,
    llmProvider: LLMProvider
  ): Promise<PipelineResult>;

  runComparisonBenchmark(request: RunBenchmarkRequest): Promise<Experiment>;
}
```

---

## 5. Builder Pattern (`src/lib/patterns/builder/`)

### Motivation
Prompt synthesis involves multiple conditional parameters: system persona instructions, few-shot constraints, token budgets, passage delimiters, and source metadata labels. Constructing these with raw string concatenation is error-prone.

### Implementation
- `ContextBuilder`: Implements `IContextBuilder`. Handles chunk ordering, metadata tagging, and token budget enforcement (`setMaxTokenBudget`).
- `PromptBuilder`: Implements `IPromptBuilder`. Fluently configures system instructions, context bodies, user queries, and behavioral constraints before validating and returning a immutable `PromptPayload`.

---

## 6. Observer Pattern (`src/lib/patterns/observer/`)

### Motivation
Benchmarking requires collecting high-resolution latency profiling, token counts, and step-by-step decision events. Embedding logging and metrics collection directly inside evaluation routines would violate the Single Responsibility Principle.

### Contract
```typescript
export interface IPipelineObserver {
  readonly id: string;
  onEvent(notification: PipelineNotification): void | Promise<void>;
}

export interface IObservablePipeline {
  addObserver(observer: IPipelineObserver): void;
  removeObserver(observerId: string): void;
  notifyObservers(notification: PipelineNotification): void;
}
```

### Implementation
- `ObservablePipelineSubject`: Subject registry notifying subscribed observers of `TraceEvent` occurrences.
- `TraceRecorderObserver`: Records and accumulates events for the visual Decision Trace timeline in the UI shell.
