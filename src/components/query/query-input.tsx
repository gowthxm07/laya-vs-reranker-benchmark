"use client";

import * as React from "react";
import { Search, Sparkles } from "lucide-react";

interface QueryInputProps {
  query: string;
  onChangeQuery: (query: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const SAMPLE_QUERIES = [
  "What attention mechanism mitigates quadratic complexity in long-context models?",
  "How does post-retrieval cross-encoder re-ranking compare to dense bi-encoder retrieval?",
  "What are the reported risk factors regarding liquidity in the 2024 annual disclosure?",
];

export function QueryInput({
  query,
  onChangeQuery,
  onSubmit,
  disabled = false,
}: QueryInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() && !disabled) {
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1">
      <label className="text-xs font-medium text-text-secondary flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-accent" />
          Natural Language Query
        </span>
        <span className="text-[10px] text-text-muted">
          Identical query evaluated on Path A & Path B
        </span>
      </label>

      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => onChangeQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter benchmark question (e.g., 'What attention mechanism mitigates quadratic complexity?')..."
          className="w-full h-9 rounded bg-surface border border-border px-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      {/* Quick sample prompt chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
        <span className="text-[10px] text-text-muted shrink-0 flex items-center gap-1 font-mono">
          <Sparkles className="h-2.5 w-2.5 text-text-secondary" />
          Sample Queries:
        </span>
        {SAMPLE_QUERIES.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onChangeQuery(sample)}
            className="text-[10px] text-text-secondary bg-surface-subtle hover:bg-surface-elevated hover:text-text-primary border border-border/70 rounded px-2 py-0.5 truncate max-w-[220px] transition-colors"
            title={sample}
          >
            {sample}
          </button>
        ))}
      </div>
    </div>
  );
}
