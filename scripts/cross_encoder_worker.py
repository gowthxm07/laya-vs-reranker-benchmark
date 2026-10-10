"""
Local Cross-Encoder Worker for PatternRAG Lab
Provides persistent batch inference using sentence-transformers CrossEncoder.
Communicates via JSON-lines over stdin/stdout.
"""
import sys
import os

# Prevent Windows OpenMP / HuggingFace Rayon clashes
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import json
import time

try:
    import torch
    num_threads = min(4, max(1, os.cpu_count() or 1))
    torch.set_num_threads(num_threads)
except Exception:
    pass

def main():
    model_name = sys.argv[1] if len(sys.argv) > 1 else "cross-encoder/ms-marco-MiniLM-L-6-v2"
    
    # Measure cold-start model load latency
    load_start = time.time()
    from sentence_transformers import CrossEncoder
    try:
        model = CrossEncoder(model_name, local_files_only=True)
    except Exception:
        # Fallback to standard load if local_files_only fails
        model = CrossEncoder(model_name)
    load_duration_ms = (time.time() - load_start) * 1000

    # Signal ready to parent process
    sys.stdout.write(json.dumps({
        "status": "ready",
        "model": model_name,
        "modelLoadLatencyMs": round(load_duration_ms, 2)
    }) + "\n")
    sys.stdout.flush()

    # Process batch requests line-by-line
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id", "default")
            query = req.get("query", "")
            documents = req.get("documents", [])

            if not query or not documents:
                sys.stdout.write(json.dumps({
                    "id": req_id,
                    "error": "query and documents must be provided and non-empty",
                    "scores": []
                }) + "\n")
                sys.stdout.flush()
                continue

            pairs = [[query, doc] for doc in documents]
            eval_start = time.time()
            scores = model.predict(pairs)
            eval_duration_ms = (time.time() - eval_start) * 1000

            # Convert numpy floats to native python floats
            float_scores = [round(float(s), 5) for s in scores]

            sys.stdout.write(json.dumps({
                "id": req_id,
                "scores": float_scores,
                "evaluationLatencyMs": round(eval_duration_ms, 2),
                "modelLoadLatencyMs": round(load_duration_ms, 2),
                "candidateCount": len(documents),
                "averageCandidateLatencyMs": round(eval_duration_ms / max(1, len(documents)), 2)
            }) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(json.dumps({
                "error": str(e),
                "scores": []
            }) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
