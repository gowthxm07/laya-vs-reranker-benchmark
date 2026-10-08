import * as React from "react";

export function Footer() {
  return (
    <footer className="border-t border-border mt-20 py-8 text-xs text-text-muted">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary">PatternRAG Lab</span>
          <span>—</span>
          <span>Cross-Encoder vs Laya Relevance Evaluation</span>
        </div>
        <div className="text-[11px] text-text-muted">
          Reproducible RAG relevance benchmarking
        </div>
      </div>
    </footer>
  );
}
