"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ComparisonMode } from "@/lib/types/comparison";
import { SlidersHorizontal } from "lucide-react";

interface QuerySectionProps {
  query: string;
  onChangeQuery: (query: string) => void;
  onRunComparison: () => void;
  isComparing: boolean;
  disabled?: boolean;
  mode: ComparisonMode;
  onChangeMode: (mode: ComparisonMode) => void;
  topK: number;
  onChangeTopK: (topK: number) => void;
  maxContextChunks: number;
  onChangeMaxContextChunks: (val: number) => void;
}

const SAMPLE_QUESTIONS = [
  "What are the standard working hours?",
  "What is the policy on company-provided equipment?",
  "What attention mechanism mitigates quadratic complexity in long-context models?",
  "What are the eligibility criteria for remote work stipends?",
];

export function QuerySection({
  query,
  onChangeQuery,
  onRunComparison,
  isComparing,
  disabled = false,
  mode,
  onChangeMode,
  topK,
  onChangeTopK,
  maxContextChunks,
  onChangeMaxContextChunks,
}: QuerySectionProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() && !disabled && !isComparing) {
      onRunComparison();
    }
  };

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div>
        <h2 className="text-xs font-mono font-semibold tracking-wider text-accent uppercase">
          02 — QUERY
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Ask a question about the uploaded document.
        </p>
      </div>

      {/* Main Input & Primary Action */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isComparing}
            placeholder="What are the standard working hours?"
            className="w-full py-3.5 px-4 rounded-lg bg-white border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors shadow-sm"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <Button
            variant="primary"
            size="lg"
            onClick={onRunComparison}
            disabled={disabled || isComparing || !query.trim()}
            isLoading={isComparing}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium shadow-sm transition-transform active:scale-[0.99]"
          >
            {isComparing ? "Running Comparison..." : "Run Comparison →"}
          </Button>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors py-1 select-none"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{showAdvanced ? "Hide options" : "Advanced options"}</span>
          </button>
        </div>
      </div>

      {/* Collapsed Advanced Options Panel */}
      {showAdvanced && (
        <div className="p-4 rounded-lg border border-border bg-surface-elevated/40 space-y-4 text-xs animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Mode selection */}
            <div>
              <label className="block text-text-secondary font-medium mb-1.5">
                Comparison Mode
              </label>
              <div className="inline-flex rounded border border-border bg-white p-0.5 w-full">
                <button
                  type="button"
                  onClick={() => onChangeMode("native")}
                  className={`flex-1 py-1 px-2 rounded text-xs transition-colors ${
                    mode === "native"
                      ? "bg-accent text-white font-medium shadow-xs"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Native Strategy
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMode("context-budget")}
                  className={`flex-1 py-1 px-2 rounded text-xs transition-colors ${
                    mode === "context-budget"
                      ? "bg-accent text-white font-medium shadow-xs"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Context-Budget
                </button>
              </div>
            </div>

            {/* Candidate Pool Size (Top-K) */}
            <div>
              <label className="block text-text-secondary font-medium mb-1.5">
                Retrieved Candidates (Top-K)
              </label>
              <select
                value={topK}
                onChange={(e) => onChangeTopK(Number(e.target.value))}
                className="w-full h-8 rounded border border-border bg-white px-2.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                <option value={5}>Top-5 Candidates</option>
                <option value={10}>Top-10 Candidates (Default)</option>
                <option value={15}>Top-15 Candidates</option>
                <option value={20}>Top-20 Candidates</option>
              </select>
            </div>

            {/* Max Context Chunks (for budget mode) */}
            <div>
              <label className="block text-text-secondary font-medium mb-1.5">
                Context Chunk Limit
              </label>
              <select
                value={maxContextChunks}
                onChange={(e) => onChangeMaxContextChunks(Number(e.target.value))}
                className="w-full h-8 rounded border border-border bg-white px-2.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                <option value={3}>3 chunks</option>
                <option value={5}>5 chunks (Standard)</option>
                <option value={8}>8 chunks</option>
              </select>
            </div>
          </div>

          {/* Sample questions helper */}
          <div className="pt-2 border-t border-border/60">
            <span className="text-[11px] text-text-muted block mb-1.5 font-medium">
              Sample test queries:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChangeQuery(q)}
                  className="px-2.5 py-1 rounded border border-border bg-white hover:bg-surface-elevated text-[11px] text-text-secondary hover:text-text-primary transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
