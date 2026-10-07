#!/usr/bin/env python3
"""
[REAL LOCAL LAYA INTEGRATION TEST]
Verifies real local Laya checkpoint at D:\laya against a controlled 3-candidate pool:
1. Clearly relevant passage
2. Clearly irrelevant passage
3. Borderline/distractor passage
"""

import sys
import os
import json
import time

MODEL_PATH = r"D:\laya" if os.path.isdir(r"D:\laya") else "convaiinnovations/laya"


def main():
    print(f"[TEST] Starting Real Laya Integration Test using model at: {MODEL_PATH}")
    t0 = time.perf_counter()

    import laya
    print(f"[TEST] laya package imported successfully (version: {getattr(laya, '__version__', 'unknown')})")

    agent = laya.Agent(MODEL_PATH)
    load_time_ms = (time.perf_counter() - t0) * 1000.0
    print(f"[TEST] Laya Agent loaded in {load_time_ms:.2f} ms")

    query = "What attention mechanisms mitigate quadratic computational complexity in long-context models?"

    candidates = [
        {
            "id": "cand_relevant",
            "type": "clearly relevant",
            "text": "Linear attention approximations and Fast Attention with Positive Orthogonal Random Features replace the softmax matrix to reduce complexity from O(N^2) to O(N)."
        },
        {
            "id": "cand_irrelevant",
            "type": "clearly irrelevant",
            "text": "Traditional French croissants require laminating butter between thin layers of yeast-leavened dough, resting in refrigeration overnight."
        },
        {
            "id": "cand_borderline",
            "type": "borderline / related",
            "text": "Recurrent neural networks process sequential tokens step-by-step with hidden state vectors, avoiding pairwise attention matrices altogether."
        }
    ]

    questions = {
        "relevance": {
            "type": "choice",
            "instructions": f"Determine whether this passage contains relevant information to answer: {query}",
            "criteria": {
                "keep": "contains relevant, helpful information for answering the query",
                "drop": "irrelevant, off-topic, or unrelated to the query"
            }
        }
    }

    states = [c["text"] for c in candidates]

    t_eval = time.perf_counter()
    batch_results = agent.predict_batch(states, questions)
    eval_time_ms = (time.perf_counter() - t_eval) * 1000.0

    print(f"\n[TEST] Batch evaluation completed in {eval_time_ms:.2f} ms ({eval_time_ms / len(candidates):.2f} ms/candidate)")
    print("-" * 75)

    all_valid = True
    for i, res in enumerate(batch_results):
        c = candidates[i]
        ans = res.get("answers", {}).get("relevance", {})
        choice = ans.get("choice", "").lower().strip()
        probs = ans.get("probabilities", {})
        confidence = ans.get("confidence")

        print(f"Candidate #{i+1} [{c['id']}] ({c['type']}):")
        print(f"  Text: {c['text'][:80]}...")
        print(f"  Decision: {choice.upper()}")
        print(f"  Keep Prob: {probs.get('keep', 'N/A')}, Drop Prob: {probs.get('drop', 'N/A')}")
        print(f"  Confidence: {confidence}")
        print()

        if choice not in ("keep", "drop"):
            print(f"  [FAIL] Invalid decision: {choice}")
            all_valid = False

    if all_valid:
        print("[TEST PASS] Real Laya integration test succeeded with strict KEEP/DROP decisions!")
        sys.exit(0)
    else:
        print("[TEST FAIL] One or more decisions were invalid.")
        sys.exit(1)


if __name__ == "__main__":
    main()
