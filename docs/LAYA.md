# Phase 4: Laya Relevance Evaluation & Semantic Pruning

## 1. Architectural Role in PatternRAG Lab

In PatternRAG Lab, **Laya** serves as the post-retrieval relevance filter for **Path B (Laya RAG)**:

```
                  Shared Document Retrieval (Phase 2)
                                 │
                                 ▼
                     Shared CandidateChunkPool
                        (Top-K Candidates)
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
      [Path A: Phase 3]                  [Path B: Phase 4]
        Cross-Encoder                      Laya Filter
      (Joint Attention)               (Semantic Pruning)
        Logit Scores                     KEEP / DROP
      Top-N Selection                  Filtered Context
                │                                 │
                └────────────────┬────────────────┘
                                 ▼
                    [Phase 5: Downstream LLM]
                         (llama3.2:3b)
```

### Contrast with Path A Cross-Encoder
- **Path A (Cross-Encoder)**: Jointly encodes query and candidate tokens through deep transformer cross-attention to produce continuous, unbounded logit scores (e.g. $+8.5$ to $-10.2$), followed by relative rank sorting and Top-N selection.
- **Path B (Laya)**: Evaluates query and candidate pairs through non-autoregressive reinforcement-learned decision heads, emitting discrete, calibrated **KEEP** or **DROP** gating decisions.
- **Objective**: The goal of this benchmark is **not** to declare one approach unilaterally superior, but to evaluate their trade-offs in context reduction, latency, token efficiency, and downstream generation faithfulness under strictly identical retrieval inputs.

---

## 2. Fundamental Experimental Control Guarantee

To preserve scientific validity across all benchmark experiments:
1. **Identical Candidate Pool**: Laya receives the exact same `CandidateChunkPool` produced by the Phase 2 shared vector retriever.
2. **Zero Secondary Retrieval**: Laya does not create embeddings, query the vector index, perform web searches, or retrieve additional passages.
3. **Lineage Preservation**: Every candidate evaluated by Laya preserves its original chunk ID, parent document ID, text, page number, source, initial vector rank (`originalRank`), and initial bi-encoder cosine similarity (`originalRetrievalScore`).
4. **No Fake Numerical Scores**: Laya is not forced to imitate a cross-encoder. Real calibrated probabilities (`keepProbability`, `dropProbability`, `layaConfidence`) are captured directly from the model runtime.

---

## 3. Local Runtime & API Contract

### Model Checkpoint & Environment
- **Checkpoint Location**: `D:\laya` (ModernBERT-large backbone, 421M parameters, non-autoregressive decision heads).
- **Library**: `laya 0.3.20` in Python 3.10.
- **Execution Mechanism**: `laya.Agent(model_id_or_path=r"D:\laya")`.

### Non-Autoregressive Decision Mechanics
Unlike autoregressive generative models, Laya does not generate text token-by-token. Given a text state and typed questions, it outputs typed decisions in a single forward pass with mathematically calibrated probabilities trained against strictly proper scoring rules (RLCD).

### Typed Relevance Question Contract
Passage relevance evaluation is formalized as a binary `choice` question:

```python
questions = {
    "relevance": {
        "type": "choice",
        "instructions": f"Determine whether this text passage contains information relevant to answering the following query: {clean_query}",
        "criteria": {
            "keep": "contains relevant, helpful, or contextual information for the query",
            "drop": "irrelevant, unrelated, tangential, or unhelpful for answering the query"
        }
    }
}
```

### Batch Evaluation
Laya supports single-batch evaluation over multiple candidate passages via `predict_batch`:

```python
states = [chunk.text for chunk in candidates]
results = agent.predict_batch(states, questions)
```

Each result in the batch returns structured output conforming to:

```json
{
  "model": "laya-rl-agent",
  "answers": {
    "relevance": {
      "type": "choice",
      "choice": "keep",
      "probabilities": { "keep": 0.9090, "drop": 0.0910 },
      "confidence": 0.5601,
      "answer_confidence": 0.9090,
      "action": { "act_probability": 1.0 }
    }
  },
  "usage": { "input_tokens": 48, "output_tokens": 0 }
}
```

---

## 4. Strict Normalization & Error Handling

- **Decision Normalization**: The adapter inspects `answers.relevance.choice`. Only exact normalized tokens `"keep"` and `"drop"` are accepted.
- **Validation Strictness**: If the runtime produces an invalid, ambiguous, or unexpected decision token (e.g. `"maybe"`, empty string, or timeout), the system throws an explicit validation error. It **never** silently defaults or guesses.
- **Zero Hallucination**: Because Laya does not generate free-form text, there is zero risk of prompt injection or generative hallucination altering the decision structure.

---

## 5. Process Architecture & Persistent Worker IPC

Similar to the Phase 3 Cross-Encoder worker, Laya incurs a PyTorch cold-start weight loading cost (~25–27 seconds on CPU). To avoid paying this overhead on every benchmark query, PatternRAG Lab implements:

- **Worker Script**: [`scripts/laya_worker.py`](../scripts/laya_worker.py)
- **Protocol**: Line-delimited JSON IPC over `stdin` and `stdout`.
- **Lifecycle Management**: [`PythonLayaProvider`](../src/lib/providers/python-laya-provider.ts) maintains a long-lived child process.
- **Warm Inference**: Once initialized, batch evaluation runs in parallel across all candidates in a single pass.
- **Offline Testing**: [`MockLayaProvider`](../src/lib/providers/mock-laya-provider.ts) provides instantaneous, zero-dependency execution for automated CI test suites.

---

## 6. Context Reduction Calculation

Context reduction measures the percentage of candidate passages pruned prior to prompt synthesis:

$$\text{Context Reduction \%} = \frac{\text{Candidate Count} - \text{Retained Count}}{\text{Candidate Count}} \times 100$$

- **Handled Safely**: Returns $0.0\%$ when candidate count is zero.
- **Candidate vs. Token Reduction**: Phase 4 measures candidate passage reduction. Downstream token-level reduction will be measured in Phase 5 when prompt templates and LLM context windows are synthesized.

---

## 7. Software Design Patterns Implemented

1. **Strategy Pattern (`RelevanceEvaluator`)**:
   [`LayaEvaluator`](../src/lib/patterns/strategy/relevance-strategy.ts) implements the polymorphic `RelevanceEvaluator` strategy, allowing the RAG orchestrator to execute Path A and Path B interchangeably.
2. **Adapter Pattern (`ILayaAdapter`)**:
   [`LayaAdapter`](../src/lib/adapters/laya-adapter.ts) isolates Laya-specific payload formatting and runtime structures from application domain models (`Chunk`, `CandidateChunkPool`).
3. **Factory Pattern (`LayaProviderFactory`)**:
   [`LayaProviderFactory`](../src/lib/providers/laya-provider-factory.ts) resolves between `PythonLayaProvider` and `MockLayaProvider` dynamically.
4. **Observer Pattern (`IPipelineObserver`)**:
   Emits lifecycle telemetry events (`relevance_evaluation_started`, `relevance_evaluation_completed`, `chunks_filtered`) without coupling evaluation logic to UI rendering or metric persistence.

---

## 8. Verification Results

### Unit Test Suite
12 automated scenarios in `src/__tests__/laya.test.ts` (47 total passed across all project suites):
1. Candidate Preservation (all 5 candidates evaluated)
2. KEEP decisions retained
3. DROP decisions preserved in discarded list without prompt inclusion
4. Metadata lineage preservation (ID, docId, source, page, text, cosine similarity)
5. Zero secondary retrieval guarantee
6. Context reduction calculation ($10 \to 4 \implies 60\%$)
7. Zero candidate handling (safe handling of empty pool)
8. Invalid response rejection (explicit error on unrecognized choice)
9. Provider error propagation
10. Single batch call behavior
11. Strategy Pattern compliance
12. Latency instrumentation verification

### Real Integration Test
Executed on local checkpoint `D:\laya` via `scripts/test-laya-integration.py`:
- Model loaded in: $27,596.87\text{ ms}$ (cold start)
- Batch evaluation: $5,550.48\text{ ms}$ for 3 passages ($1,850.16\text{ ms/candidate}$ on CPU)
- Relevant passage: **KEEP** ($P(\text{keep}) = 0.909$, confidence: $0.5601$)
- Irrelevant passage: **DROP** ($P(\text{drop}) = 0.5751$, confidence: $0.0164$)
- Borderline passage: **KEEP** ($P(\text{keep}) = 0.7926$, confidence: $0.2636$)
