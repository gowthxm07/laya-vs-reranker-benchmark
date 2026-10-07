# Controlled Cross-Encoder vs. Laya LLM Comparison (Phase 5)

> **Core Objective:** Evaluate and compare post-retrieval relevance strategies (Path A: Cross-Encoder Reranker vs. Path B: Laya Relevance Filter) by feeding their selected context to the **EXACT SAME downstream LLM (`llama3.2:3b` via Ollama)** under identical conditions.

---

## 1. System Architecture & Controlled Pipeline

The comparative benchmark isolates post-retrieval relevance evaluation as the **sole independent variable**:

```
                              User Query
                                   │
                                   ▼
                         [Shared Retrieval]
                       (Ollama nomic-embed-text)
                                   │
                                   ▼
                       [CandidateChunkPool]
                      (Shared Immutable Pool)
                         /               \
                        /                 \
                       ▼                   ▼
              CrossEncoderEvaluator    LayaEvaluator
             (ms-marco-MiniLM-L-6-v2)  (ModernBERT-large)
                       │                   │
                       ▼                   ▼
                 Top-N Rerank         KEEP / DROP Filter
                       │                   │
                       ▼                   ▼
                  Context A            Context B
                       │                   │
                       └─────────┬─────────┘
                                 ▼
                             SAME LLM
                       (Ollama llama3.2:3b)
                       (temperature=0, seed=42)
                                 │
                         ┌───────┴───────┐
                         ▼               ▼
                      Answer A        Answer B
```

---

## 2. Strict Experimental Controls

To ensure scientific validity and eliminate confounding factors:

| Parameter | Controlled Value / Rule |
| :--- | :--- |
| **User Query** | Exact identical string passed to both branches |
| **Document Corpus** | Exact same documents, parser (`PdfDocumentParser`, `TextDocumentParser`, `MarkdownDocumentParser`) |
| **Chunking** | Deterministic 500-char chunks with 100-char overlap |
| **Embeddings & Vector Store** | `nomic-embed-text` (768-dim) in atomic JSON vector store |
| **Initial Retrieval Pool** | Identical `CandidateChunkPool` with same IDs, ranks, and cosine similarity scores |
| **Secondary Retrieval** | **STRICTLY PROHIBITED**: Neither strategy receives additional retrieval passes |
| **Context Assembly** | Identical `ContextBuilder` formatting (`[Passage N] \| Source \| Page \| Chunk`) |
| **Score Leakage** | Context passages omit model-specific relevance scores to avoid prompting bias |
| **Downstream LLM** | Exact same model: local `llama3.2:3b` hosted on Ollama |
| **Prompt Template** | Identical system instruction and user prompt template via `PromptBuilder` |
| **Generation Parameters** | Identical parameters: `temperature = 0`, `seed = 42` |
| **Execution Order** | Deterministic sequential execution to avoid CPU/RAM resource contention |

---

## 3. Comparison Modes

The benchmark supports two distinct evaluation modes:

### Mode A: Native Strategy Mode
Measures what happens when each approach operates in its native design configuration:
- **Path A (Cross-Encoder):** Selects configured `topN` (default: 5) highest-scoring reranked passages.
- **Path B (Laya):** Retains all passages where Laya emitted binary `KEEP` gating decisions.

### Mode B: Context-Budget Mode
Enforces an equal maximum context budget (`maxContextChunks`, e.g., 5) across both paths:
- **Path A (Cross-Encoder):** Selects top $N \le \text{budget}$ reranked passages.
- **Path B (Laya):** Retains `KEEP` candidates. If $\text{count}(\text{KEEP}) > \text{budget}$, applies the deterministic benchmark constraint:
  $$\text{selected} = \text{retainedCandidates}[0:\text{budget}]$$
  *Note: Preserving original vector retrieval order among KEEP chunks is explicitly documented as a benchmark evaluation policy, not a native ranking feature of Laya.*

---

## 4. Shared Generation Prompt Design

Both paths use the single shared template assembled by `PromptBuilder`:

### System Instruction
```text
You are a factual, concise question-answering assistant.
Answer the user query strictly using the provided context passages.
If the context does not contain enough information, explicitly state:
"The provided context does not contain sufficient information to answer this question."
Do not invent facts or extrapolate beyond what is directly stated.
```

### Context Passage Serialization
```text
[Passage 1] | Source: attention_mechanisms.pdf | Page: 3 | Chunk: chunk-1
Linear attention approximations and Fast Attention replace the softmax matrix with kernel feature maps...

---

[Passage 2] | Source: attention_mechanisms.pdf | Page: 7 | Chunk: chunk-3
FlashAttention computes softmax within GPU SRAM tiles...
```

### User Query Block
```text
CONTEXT:
{contextText}

USER QUESTION:
{userQuery}
```

---

## 5. Empty-Context Policy

If a strategy filters out all candidate chunks ($\text{count}(\text{retained}) = 0$, e.g., Laya marks all passages as `DROP`):
1. **Zero Fallback Chunks:** No unrelated or raw retrieval chunks are injected.
2. **Explicit Prompt Context:** Prompt is formatted with:
   ```text
   CONTEXT:
   [No relevant context passages were retained]

   USER QUESTION:
   {userQuery}
   ```
3. **LLM Output:** Downstream LLM generates an explicit statement that the retrieved evidence is insufficient.
4. **Metrics:** Retained count and context tokens are recorded as $0$.

---

## 6. Token & Latency Instrumentation

### Token Metrics
Extracted directly from Ollama runtime response fields without heuristics:
- **`prompt_eval_count`**: Exact input/prompt tokens evaluated.
- **`eval_count`**: Exact output/completion tokens generated.
- **`totalTokens`**: Sum of prompt and completion tokens.
- **`contextTokenCount`**: Estimated context tokens via `estimateTokenCount()`.

### Independent Latency Breakdown
The benchmark isolates every phase without aggregating relevance overhead into LLM latency:
- **Shared Retrieval Latency:** Time spent embedding query and performing vector cosine similarity search.
- **Relevance Evaluation Latency:**
  - Path A: Cross-Encoder joint scoring (`evaluationLatencyMs`).
  - Path B: Laya non-autoregressive batch evaluation (`evaluationLatencyMs`).
- **Context Construction Latency:** Assembly and formatting time (`contextBuildLatencyMs`).
- **Downstream Generation Latency:** Active LLM forward-pass and token decoding time (`generationLatencyMs`).
- **Total Path Latency:** $\text{Relevance} + \text{Context} + \text{Generation}$.
- **Wall-Clock Latency:** Total sequential benchmark runtime.

---

## 7. Sequential Execution Rationale

On a developer workstation with standard CPU and RAM (e.g., 16–32 GB, non-dedicated GPU), running two simultaneous generations against `llama3.2:3b` causes:
1. Thread starvation and memory bandwidth saturation.
2. Artificially elevated and noisy latency measurements.
3. Unfair CPU thread scheduling between requests.

Therefore, the benchmark runs **deterministically sequential**:
1. Path A (Cross-Encoder reranking $\rightarrow$ Context A $\rightarrow$ LLM Generation A)
2. Path B (Laya filtering $\rightarrow$ Context B $\rightarrow$ LLM Generation B)

Each path measures its own discrete start and end timestamps.

---

## 8. Verification & Live Integration Results

Live CPU verification against local Ollama `llama3.2:3b`:
- **Path A (Cross-Encoder):**
  - Relevance latency: `~280 ms` (scored 4 passages on CPU).
  - Selected 3 relevant chunks, filtered out cooking distractors.
  - LLM Generation: `~37.2 s` (CPU generation).
  - Answer cited Passage 2 facts accurately.
- **Path B (Laya):**
  - Relevance latency: `~8.1 s` (evaluated 4 passages on ModernBERT-large CPU).
  - Selected candidate passages with calibrated KEEP probabilities.
  - LLM Generation: `~30.9 s` (CPU generation).
  - Answer cited Passage 1 facts accurately.
- **Experimental Controls:**
  - Exactly identical prompt structure.
  - Exactly identical temperature (`0`) and seed (`42`).
  - No winner declared.

---

## 9. Boundary Reminder: Phase 6 Preview

Phase 5 strictly implements execution and inspection of answers and latencies.  
**DO NOT declare a "Winner" in Phase 5.**

Phase 6 will introduce objective evaluation metrics:
- Faithfulness and hallucination rate
- Answer relevancy
- Token efficiency ratio
- Context reduction precision and recall
- Automated evaluation datasets
