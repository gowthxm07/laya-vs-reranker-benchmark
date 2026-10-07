import * as React from "react";

export function Footer() {
  return (
    <footer className="border-t border-border/80 bg-canvas-subtle/50 mt-12 py-6 text-xs text-text-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-secondary">PatternRAG Lab</span>
          <span>—</span>
          <span>Software Design Patterns in Retrieval-Augmented Generation</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-text-muted">
          <span>Phase 1: Architecture & UI Shell</span>
          <span>•</span>
          <span>Zero Fake Data Guarantee</span>
          <span>•</span>
          <span>Modular Strategy Contracts</span>
        </div>
      </div>
    </footer>
  );
}
