#!/usr/bin/env python3
"""
[LAYA PERSISTENT RELEVANCE WORKER]
Long-lived child process worker that maintains a loaded laya.Agent instance in memory.
Communicates via standard input / standard output using line-delimited JSON messages.
Eliminates per-request PyTorch model weight loading latency (~25s on CPU).
"""

import sys
import os
import json
import time
import argparse
import warnings

# Suppress noisy library runtime warnings from polluting stdout
warnings.filterwarnings("ignore")

DEFAULT_MODEL_PATH = r"D:\laya" if os.path.isdir(r"D:\laya") else "convaiinnovations/laya"


def parse_args():
    parser = argparse.ArgumentParser(description="Laya Persistent Relevance Evaluation Worker")
    parser.add_argument(
        "--model",
        type=str,
        default=os.environ.get("LAYA_MODEL_PATH", DEFAULT_MODEL_PATH),
        help="Path or HuggingFace ID of the Laya model checkpoint"
    )
    return parser.parse_args()


def build_relevance_question(query: str):
    """
    Constructs the typed choice question definition for passage relevance filtering.
    Enforces a strict binary choice: 'keep' vs 'drop'.
    """
    clean_query = query.strip()
    return {
        "relevance": {
            "type": "choice",
            "instructions": f"Determine whether this text passage contains information relevant to answering the following query: {clean_query}",
            "criteria": {
                "keep": "contains relevant, helpful, or contextual information for the query",
                "drop": "irrelevant, unrelated, tangential, or unhelpful for answering the query"
            }
        }
    }


def main():
    args = parse_args()
    model_path = args.model

    # 1. Cold-start model initialization
    load_start = time.perf_counter()
    try:
        import laya
        agent = laya.Agent(model_path)
        load_duration_ms = (time.perf_counter() - load_start) * 1000.0
    except Exception as e:
        err_msg = json.dumps({"status": "error", "error": f"Failed to load Laya model from '{model_path}': {str(e)}"})
        sys.stdout.write(err_msg + "\n")
        sys.stdout.flush()
        sys.exit(1)

    is_cold_start = True

    # Announce ready status to parent process
    ready_msg = json.dumps({
        "status": "ready",
        "model": getattr(agent, "model_id", model_path),
        "modelLoadLatencyMs": round(load_duration_ms, 2)
    })
    sys.stdout.write(ready_msg + "\n")
    sys.stdout.flush()

    # 2. Continuous JSON-lines request loop over stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
            action = req.get("action", "evaluate")

            if action == "health":
                response = {
                    "success": True,
                    "status": "ok",
                    "model": getattr(agent, "model_id", model_path)
                }
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
                continue

            if action == "evaluate":
                query = req.get("query", "").strip()
                candidates = req.get("candidates", [])

                if not query:
                    raise ValueError("Query cannot be empty for Laya relevance evaluation.")

                if not candidates or len(candidates) == 0:
                    response = {
                        "success": True,
                        "decisions": [],
                        "evaluationLatencyMs": 0,
                        "modelLoadLatencyMs": round(load_duration_ms, 2) if is_cold_start else 0,
                        "isColdStart": is_cold_start
                    }
                    sys.stdout.write(json.dumps(response) + "\n")
                    sys.stdout.flush()
                    is_cold_start = False
                    continue

                # Prepare batch inputs
                states = [c.get("text", "") for c in candidates]
                questions = build_relevance_question(query)

                eval_start = time.perf_counter()
                batch_results = agent.predict_batch(states, questions)
                eval_duration_ms = (time.perf_counter() - eval_start) * 1000.0

                if len(batch_results) != len(candidates):
                    raise RuntimeError(
                        f"Laya batch result length mismatch: expected {len(candidates)}, got {len(batch_results)}"
                    )

                decisions = []
                for i, res in enumerate(batch_results):
                    chunk_id = candidates[i].get("id", f"chunk_{i}")
                    ans = res.get("answers", {}).get("relevance", {})
                    choice = ans.get("choice", "").lower().strip()

                    # Strict normalization & validation: strictly 'keep' or 'drop'
                    if choice not in ("keep", "drop"):
                        raise ValueError(
                            f"Invalid/unrecognized Laya decision '{choice}' for candidate '{chunk_id}'. "
                            f"Expected strict 'keep' or 'drop'."
                        )

                    probs = ans.get("probabilities", {})
                    keep_prob = float(probs.get("keep", 0.0))
                    drop_prob = float(probs.get("drop", 0.0))
                    confidence = float(ans.get("confidence", 0.0)) if ans.get("confidence") is not None else None
                    answer_confidence = float(ans.get("answer_confidence", 0.0)) if ans.get("answer_confidence") is not None else None

                    decisions.append({
                        "chunkId": chunk_id,
                        "decision": choice,
                        "keepProbability": round(keep_prob, 4),
                        "dropProbability": round(drop_prob, 4),
                        "confidence": round(confidence, 4) if confidence is not None else None,
                        "answerConfidence": round(answer_confidence, 4) if answer_confidence is not None else None,
                        "rawModelOutput": ans
                    })

                response = {
                    "success": True,
                    "model": getattr(agent, "model_id", model_path),
                    "decisions": decisions,
                    "evaluationLatencyMs": round(eval_duration_ms, 2),
                    "modelLoadLatencyMs": round(load_duration_ms, 2) if is_cold_start else 0,
                    "isColdStart": is_cold_start
                }

                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
                is_cold_start = False

            else:
                raise ValueError(f"Unknown action: '{action}'")

        except Exception as err:
            err_response = {
                "success": False,
                "error": str(err)
            }
            sys.stdout.write(json.dumps(err_response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
