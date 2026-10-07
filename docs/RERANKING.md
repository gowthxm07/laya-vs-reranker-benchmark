# Phase 3: Advanced RAG Cross-Encoder Reranking Architecture

## 1. Architectural Overview

PatternRAG Lab provides a rigorous, controlled evaluation platform comparing two post-retrieval relevance paradigms:
- **Path A (Advanced RAG)**: Cross-Encoder Transformer Reranking (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
- **Path B (Laya RAG)**: Laya Relevance Filtering & Semantic Pruning (Phase 4)

In Phase 3, we implement the complete **Path A Baseline** pipeline.

```
                         Document Collection
                                 │
                                 ▼
                     [Deterministic Chunker]
                                 │
                                 ▼
                    [nomic-embed-text (Ollama)]
                                 │
                                 ▼
                      [Local Vector Store]
                                 │
                                 ▼
                            User Query
                                 │
                                 ▼
                       CandidateChunkPool
                        (Top-K Candidates)
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
        [Path A: Phase 3]                 [Path B: Phase 4]
          Cross-Encoder                     Laya Filter
        (Joint Attention)               (Semantic Pruning)
                │                                 │
                ▼                                 ▼
      RerankedCandidatePool               Filtered Context
       (Top-N Selected)                    (Selected Chunks)
                │                                 │
                └────────────────┬────────────────┘
                                 ▼
                    [Phase 5: Downstream LLM]
                         (llama3.2:3b)
```

---

## 2. Bi-Encoder vs. Cross-Encoder Mechanics

Standard RAG architectures rely on two distinct retrieval stages to balance latency and precision:

| Dimension | First-Stage: Bi-Encoder (`nomic-embed-text`) | Second-Stage: Cross-Encoder (`ms-marco-MiniLM-L-6-v2`) |
| :--- | :--- | :--- |
| **Input Structure** | Embeds Query $q$ and Passage $p$ independently: $f(q)$ and $f(p)$ | Jointly encodes Query and Passage together: $f(q \circ p)$ |
| **Attention Mechanism** | Zero cross-attention between query and passage tokens during indexing | Full bidirectional self-attention across all tokens in $q$ and $p$ simultaneously |
| **Complexity** | $O(N \cdot d)$ via dot-product / cosine similarity in vector space | $O((|q| + |p|)^2)$ transformer self-attention layers per pair |
| **Strengths** | Fast sub-linear approximate nearest neighbor search over millions of chunks | Detects nuanced term interactions, negations, word order, and semantic nuance |
| **Weaknesses** | Information bottleneck: compresses entire passage into single 768-dim vector | Computationally prohibitive for entire corpus; suitable only for candidate pools |

---

## 3. Scoring Semantics & Logit Interpretation

### Unbounded Logit Scores
The `cross-encoder/ms-marco-MiniLM-L-6-v2` model is trained on the MS MARCO passage ranking dataset. It outputs **raw, unbounded classification logits** (typically ranging from $-11.0$ to $+11.0$):
- **High positive logits** ($+4.0$ to $+9.5$): Strong semantic relevance to the specific question asked.
- **Near-zero logits** ($-1.0$ to $+1.5$): Weak, ambiguous, or marginal relevance.
- **Negative logits** ($-2.0$ to $-10.5$): Irrelevant passages, distractor topics, or keyword collisions.

### Why Arbitrary Thresholds (e.g. `score > 0.5`) Must NOT Be Used
In cross-encoder architectures, logit values are **relative ranking signals**, not calibrated probabilities. 
- Applying a naive threshold such as `score > 0.5` would discard valid passages for difficult queries where all logits are shifted negative, or admit irrelevant passages for broad queries.
- Therefore, the Advanced RAG standard pattern is **Top-N Selection**: candidates are sorted in descending order by logit score, and the top $N$ highest-scoring chunks are retained for downstream generation.

---

## 4. The Single Source of Truth Control Boundary

### Fair Benchmark Guarantee
To guarantee a fair scientific comparison between Cross-Encoder reranking and Laya filtering:
1. **Identical Candidate Pool**: Both evaluators receive the exact same `CandidateChunkPool` containing identical chunk IDs, text, metadata, initial bi-encoder ranks, and cosine retrieval scores.
2. **Zero Secondary Retrieval**: The cross-encoder does not execute new database queries, expand searches, or retrieve additional documents. It acts strictly as a post-retrieval evaluator.
3. **Traceable Rank Shifts**: Every reranked candidate records its original vector rank (`originalRank`), its cross-encoder rank (`rerankedRank`), and its position delta (`rankDelta = originalRank - rerankedRank`).

---

## 5. Latency & Process Architecture

### Cold Start vs. Warm Inference
Cross-encoder models require PyTorch model weights to be loaded into memory:
- **Cold Load Time**: ~20–25 seconds on CPU to import `torch`, `sentence_transformers`, and allocate model weights into memory.
- **Warm Batch Inference**: ~70–150 ms total for a batch of 10 candidate passages on CPU.

### Persistent Python Worker IPC
Spawning a fresh Python interpreter for each rerank request would impose a prohibitive ~22s penalty per query. PatternRAG Lab implements a **persistent child process worker**:
- `scripts/cross_encoder_worker.py`: A long-lived Python worker initialized on first request.
- **Communication Protocol**: Line-delimited JSON IPC over standard input (`stdin`) and standard output (`stdout`).
- **Cold-Start Detection**: The worker reports `isColdStart: true` and `modelLoadLatencyMs` on first load, followed by `isColdStart: false` on all subsequent warm queries.
- **Graceful Lifecycle Management**: The `PythonCrossEncoderProvider` manages health checks, timeouts, process disposal, and error recovery.

---

## 6. Software Design Patterns Implemented

### 1. Strategy Pattern (`RelevanceEvaluator`)
The post-retrieval stage is encapsulated behind the `RelevanceEvaluator` interface:
```typescript
interface RelevanceEvaluator {
  readonly id: string;
  readonly name: string;
  evaluateRelevance(request: RelevanceEvaluationRequest): Promise<RelevanceEvaluationResult>;
}
```
`CrossEncoderEvaluator` implements this strategy, while `LayaEvaluator` will implement it in Phase 4.

### 2. Factory Pattern (`CrossEncoderProviderFactory`)
Decouples caller code from provider creation and enables switching between `python` and `mock` providers for fast offline testing:
```typescript
const provider = CrossEncoderProviderFactory.getProvider();
```

### 3. Observer Pattern (`ObservablePipeline`)
Emits lifecycle telemetry events during reranking:
- `relevance_evaluation_started`: Emitted before batch scoring begins.
- `relevance_evaluation_completed`: Emitted after scoring, recording evaluation latency and candidate counts.
- `chunks_filtered`: Emitted when Top-N selection partitions candidates into retained and discarded sets.

---

## 7. Verification & Test Suite

The Phase 3 test suite covers 12 comprehensive scenarios in `src/__tests__/reranking.test.ts`:
1. **Candidate Preservation**: All input candidates are evaluated and accounted for.
2. **Chunk ID Mapping**: Scores attach to exact chunk IDs.
3. **Monotonic Order**: Candidates are sorted strictly descending by logit score.
4. **Metadata Preservation**: Page numbers, sources, and original cosine scores remain intact.
5. **Top-N Selection**: Top $N$ chunks are marked `retained`, remainder marked `discarded`.
6. **Pool Lineage**: Candidate pool ID and query lineage are preserved.
7. **Empty Pool Handling**: Graceful return for 0-candidate inputs.
8. **Provider Error Handling**: Robust error recovery when child process fails.
9. **Latency Metrics**: Evaluation, average per-candidate, and total latency calculation.
10. **Batch Behavior**: All candidates evaluated in a single batch call.
11. **Strategy Pattern Compliance**: Integration with `RelevanceEvaluator` interface.
12. **Rank Delta Verification**: Accurate tracking of positive and negative position shifts.
