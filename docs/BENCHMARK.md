# Objective Benchmark & Evaluation Methodology (Phase 6)

## 1. Benchmark Objective

**PatternRAG Lab Phase 6** establishes a controlled, reproducible, and objective benchmark framework to evaluate post-retrieval relevance strategies on identical RAG workloads:

- **Path A — Advanced RAG Baseline**: Joint cross-attention reranking via `cross-encoder/ms-marco-MiniLM-L-6-v2`.
- **Path B — Laya RAG Strategy**: Non-autoregressive System 1 binary relevance gating via local `ModernBERT-large` (421M parameters, `D:\laya`).

> **Empirical Findings Notice:**  
> For the complete research report, empirical numbers, hardware runtime profiles, and Pareto tradeoff analysis from the 36-case benchmark run, see [`docs/FINAL_RESULTS.md`](FINAL_RESULTS.md). For the presentation walkthrough, see [`docs/DEMO_GUIDE.md`](DEMO_GUIDE.md).

### Core Scientific Research Principle
> **Tradeoffs, Not Premature Winners**:  
> No single arbitrary weighted "winner score" (e.g. $30\%\text{ accuracy} + 30\%\text{ latency} + 40\%\text{ context}$) is computed. A post-retrieval strategy may achieve higher recall while consuming more context, or execute with ultra-low latency while exhibiting conservative selection boundaries. This benchmark reports each metric independently, exposes multi-dimensional Pareto relationships, and preserves raw evaluation records.

---

## 2. Experimental Controls Architecture

To ensure scientific validity, both pipelines execute under strict experimental controls:

```
                            BENCHMARK DATASET
                        (36 Deterministic Cases)
                                   │
                                   ▼
                            SHARED RETRIEVAL
                        (CandidateChunkPool)
                           /             \
                          /               \
                         ▼                 ▼
                 Path A (Cross-Encoder)   Path B (Laya RAG)
                 ms-marco-MiniLM-L-6-v2   ModernBERT-large (D:\laya)
                         │                 │
                         ▼                 ▼
                     Context A         Context B
                         │                 │
                         └────────┬────────┘
                                  ▼
                         DOWNSTREAM LLM
                           llama3.2:3b
                   (temp: 0, seed: 42, stream: false)
                                  │
                         ┌────────┴────────┐
                         ▼                 ▼
                      Answer A          Answer B
                         │                 │
                         └────────┬────────┘
                                  ▼
                        OBJECTIVE EVALUATOR
              (Relevance, Context, Token, Answer, Latency)
                                  │
                                  ▼
                         BENCHMARK REPORT
               (Aggregates, Categories, Pareto, Raw JSON)
```

1. **Identical Query & Candidate Pool**: Both paths receive the identical, immutable candidate chunk pool. Zero independent retrieval.
2. **Identical Downstream LLM**: Both paths feed context to the same local `llama3.2:3b` model via Ollama (`http://localhost:11434`).
3. **Identical Prompt Template & Zero Leakage**: Both paths use the exact benchmark prompt format without score leakage, rank tags, or strategy branding.
4. **Identical Generation Options**: Both paths generate with `temperature: 0` and `seed: 42`.
5. **Sequential Execution**: Sequential execution avoids multi-threaded CPU/RAM contention and latency distortion.

---

## 3. Dataset Structure

The benchmark dataset is located at [`data/benchmark/benchmark-dataset.json`](../data/benchmark/benchmark-dataset.json) and comprises 36 carefully curated test cases.

```json
{
  "id": "bench-norm-01",
  "category": "NORMAL",
  "query": "What is the primary role of positional encoding in Transformer models?",
  "description": "Standard retrieval with a clearly relevant chunk explaining positional encodings among general Transformer architectural text.",
  "relevantChunkIds": ["norm-01-c1"],
  "referenceAnswer": "Positional encodings provide sequence order and token position information to the model since Transformers lack recurrence and convolution.",
  "answerable": true,
  "requiredFacts": ["positional encoding", "recurrence", "order"],
  "candidateChunks": [
    {
      "id": "norm-01-c1",
      "documentId": "doc-transformer",
      "source": "attention-is-all-you-need.pdf",
      "pageNumber": 3,
      "section": "Positional Encoding",
      "text": "Because the Transformer model contains no recurrence and no convolution, positional encodings are injected at the bottoms of the encoder and decoder stacks to provide token order information.",
      "retrievalScore": 0.88,
      "rank": 1,
      "decision": "pending"
    }
  ]
}
```

### Determinism Guarantee
- Ground-truth relevance labels (`relevantChunkIds`) and reference answers are defined independently of the evaluated systems.
- Ground truth is never generated dynamically by Cross-Encoder, Laya, or the downstream LLM.

---

## 4. Benchmark Categories (9 Evaluation Categories)

The dataset contains 4 cases across each of the 9 categories (36 total cases):

| Category | Description | Primary Evaluation Challenge |
|:---|:---|:---|
| `NORMAL` | Standard queries where clear supporting evidence exists among typical domain background passages. | Baseline relevance & answer accuracy. |
| `DISTRACTOR_HEAVY` | 1 target passage buried among 4–5 topically misleading or out-of-domain distractors. | Resistance to distractor injection and context pollution. |
| `MULTI_CHUNK` | Queries requiring synthesis of distinct passages (e.g. BERT MLM + NSP, 2PL Growing + Shrinking). | Multi-passage recall without premature pruning. |
| `AMBIGUOUS` | Queries with overlapping valid interpretations (e.g., causal vs MLM masking). | Balanced retention of valid semantic interpretations. |
| `PARTIAL_CONTEXT` | Queries where only a subset of required facts are present in the collection. | Accurately answering available facts while stating missing attributes. |
| `NO_ANSWER` | Intentional unanswerable queries where candidate passages contain zero relevant evidence. | Refusal compliance (`noAnswerCompliance`) and aggressive context pruning for unanswerable queries. |
| `SINGLE_RELEVANT` | Exactly 1 highly specific target passage among general background text. | Precision and aggressive noise elimination. |
| `CONFLICTING_CONTEXT` | Candidate passages containing contradictory claims (e.g. ancient Rome population estimates). | Reporting conflicting evidence without arbitrary bias. |
| `LONG_CONTEXT` | 8 candidate passages (larger candidate pool) with multiple relevant elements. | Scalability and selectivity across higher token budgets. |

---

## 5. Metrics Specification

### A. Relevance Selection Metrics
1. **Precision**:
   $$\text{Precision} = \frac{|\text{Selected} \cap \text{Relevant}|}{|\text{Selected}|}$$
   Measures context purity. If 0 chunks are selected and 0 are relevant, precision is 1.0; if 0 chunks are selected but relevant chunks exist, precision is 0.0.
2. **Recall**:
   $$\text{Recall} = \frac{|\text{Selected} \cap \text{Relevant}|}{|\text{Relevant}|}$$
   Measures evidence retention.
3. **F1 Score**:
   $$F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$
   Harmonic mean of precision and recall.
4. **Hit Rate**:
   $$\text{HitRate} = \mathbb{I}(|\text{Selected} \cap \text{Relevant}| \ge 1)$$
   Binary indicator of whether at least one ground-truth passage was supplied to the LLM.
5. **Mean Reciprocal Rank (MRR)**:
   $$\text{MRR} = \frac{1}{\text{rank}_{\text{first relevant}}}$$
   Computed for ranking strategies (Cross-Encoder). For Laya, MRR is reported as **Not Applicable (N/A)** because Laya is a non-autoregressive binary filter and does not fabricate artificial ordinal ranks.
6. **NDCG@K**:
   Computed for ranking strategies with binary ground-truth gain. Not fabricated for Laya.

### B. Context Efficiency Metrics
- `initialCandidateCount`, `retainedCount`, `retentionRate` ($\frac{\text{retained}}{\text{initial}}$).
- `contextReductionPercent` ($\frac{\text{initial} - \text{retained}}{\text{initial}} \times 100\%$).
- `initialContextCharacters`, `retainedContextCharacters`, `characterReductionPercent`.
- `initialContextTokens`, `retainedContextTokens`, `tokenReductionPercent`.
- *Note*: Character reduction and token reduction are kept strictly separate.

### C. Answer Quality & Lexical Groundedness Metrics
1. **Exact Match**: Case- and punctuation-normalized identity check against ground-truth reference answer.
2. **Reference Answer Similarity**: Lexical Jaccard and Dice coefficient overlap ($0.0$ to $1.0$).
3. **Fact / Keyword Coverage**: Proportion of case `requiredFacts` explicitly surfaced in the answer. Supports both direct phrase presence and multi-token decomposition.
4. **No-Answer Compliance (`noAnswerCompliance`)**: For `answerable = false` cases, verifies whether the answer acknowledges lack of context (e.g. "cannot be determined", "insufficient evidence", "not mentioned in context") rather than hallucinating.
5. **Lexical Groundedness (`lexicalGroundednessScore`)**: Deterministic proportion of non-stopword content tokens in the answer that are verbatim present in the selected context passages. Avoids subjective or non-reproducible semantic score approximations.

> [!NOTE]
> **Phase 7 Metric Audit — Fact Coverage in Mock vs Live Mode**:
> In Phase 6 testing, mock runs reported 22.68% Fact Coverage for both paths because `MockLLMProvider` generated uniform boilerplate text rather than extracting context passages. In Phase 7, `MockLLMProvider` was enhanced to synthesize sentences directly from retained candidate passages, allowing mock test runs to accurately reflect whether required domain facts were retained or dropped (e.g. 88.9% mean coverage across retaining paths). Live evaluation runs using local Ollama `llama3.2:3b` continue to produce natural language responses with full factual synthesis.

### D. Component Latency Instrumentation
- `relevanceLatencyMs`: Cross-Encoder transformer inference vs Laya classification.
- `contextBuildLatencyMs`: Formatting retained passages into prompt context text.
- `generationLatencyMs`: Downstream Ollama LLM completion latency.
- `totalLatencyMs`: End-to-end execution time for the pipeline.

### E. Exact Token Accounting
Directly captured from Ollama API responses:
- `promptTokens`: Context and question token count (`prompt_eval_count`).
- `completionTokens`: Generated answer token count (`eval_count`).
- `totalTokens`: Combined token footprint.

---

## 6. Dual Comparison Modes

### Native Strategy Mode (`native`)
- **Path A (Cross-Encoder)**: Retains its top-$N$ ranked candidates ($N=5$).
- **Path B (Laya)**: Retains all candidates classified as `KEEP`.
- Measures how each system behaves in its natural production configuration.

### Context-Budget Mode (`context_budget`)
- Both strategies are capped at an identical chunk budget (e.g., $K = 3$).
- **Path A**: Takes the top-$K$ candidates by cross-encoder score.
- **Path B**: Retains `KEEP` candidates up to $K$, preserving original retrieval order as a deterministic tie-breaker.
- Isolates the effect of passage ranking versus binary classification under identical token limits.

---

## 7. Statistical Aggregations & Paired Comparisons

### Aggregate Statistics
For all metrics, the benchmark computes:
- Sample Count ($N$)
- Mean
- Median (robust to latency outliers)
- Minimum & Maximum
- Standard Deviation ($\sigma$)

### Paired Differences ($CE - Laya$)
For each query $i$:
$$\Delta_i = M_{CE, i} - M_{Laya, i}$$
The benchmark reports:
- Mean and median paired difference.
- Count of queries where Cross-Encoder is strictly superior ($CE > Laya$).
- Count of queries where Laya is strictly superior ($Laya > CE$).
- Count of exact ties.

---

## 8. Multi-Dimensional Pareto Tradeoff Analysis

Rather than applying arbitrary weights, the benchmark performs multi-attribute dominance analysis across 5 key dimensions:
1. **Relevance F1** (Higher is better)
2. **Fact Coverage** (Higher is better)
3. **Context Reduction %** (Higher is better)
4. **Relevance Latency** (Lower is better)
5. **Total Latency** (Lower is better)

A strategy $A$ **dominates** strategy $B$ if and only if:
$$\forall d \in D, \quad \text{score}_A(d) \ge \text{score}_B(d) \quad \text{and} \quad \exists d \in D, \quad \text{score}_A(d) > \text{score}_B(d)$$

When neither strategy dominates, the query represents a **Pareto Tradeoff**, illustrating conditions where one method trades latency for selectivity or vice versa.

---

## 9. Failure Analysis Diagnostics

Every query result is categorized into an objective failure taxonomy:
- `BOTH_CORRECT`: Both strategies retained all relevant chunks and discarded all distractors.
- `BOTH_INCORRECT`: Both strategies failed on relevance retention or refusal.
- `CROSS_ENCODER_FALSE_POSITIVE`: Cross-Encoder retained irrelevant distractor chunks that Laya pruned.
- `CROSS_ENCODER_FALSE_NEGATIVE`: Cross-Encoder dropped a relevant passage outside top-$N$.
- `LAYA_FALSE_NEGATIVE`: Laya dropped a relevant ground-truth chunk (`DROP` classification).
- `LAYA_FALSE_POSITIVE`: Laya retained an irrelevant distractor chunk (`KEEP` classification).
- `PARTIAL_AGREEMENT`: Mixed retention boundaries across multi-chunk queries.

---

## 10. Reproducibility & Output Format

All benchmark runs record environment and execution metadata:
- Timestamp & Git Commit SHA
- Dataset Version (`1.0.0`)
- Model identifiers: `llama3.2:3b`, `cross-encoder/ms-marco-MiniLM-L-6-v2`, `ModernBERT-large`
- Host runtime details (`process.platform`, `process.arch`)
- Run parameters: mode, budget, repetitions

Raw output files are saved to `data/benchmark/results/benchmark-run-<timestamp>.json` and ignored by Git to prevent repo bloat.

---

## 11. Known Hardware Considerations & Limitations

1. **CPU Execution Speed**:
   Running 36 cases with local `llama3.2:3b` generation takes ~30–35s per LLM call on a laptop CPU. In development and testing, mock providers allow instantaneous deterministic verification in under 300ms.
2. **Lexical Groundedness vs Semantic Entailment**:
   Lexical Groundedness measures the proportion of non-stopword answer content tokens that appear in the retained context. It is a deterministic lexical overlap measure and is not a substitute for semantic faithfulness evaluation.
3. **Laya Warm-Up**:
   Laya's PyTorch worker takes ~24s for cold-start weight loading, after which inference runs in batch mode.
