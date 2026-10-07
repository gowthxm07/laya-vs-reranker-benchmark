"use client";

import * as React from "react";
import { DocumentDataset } from "@/lib/types/dataset";
import { DatasetSelector } from "./dataset-selector";
import { QueryInput } from "./query-input";
import { Button } from "@/components/ui/button";
import { Search, Info, SlidersHorizontal } from "lucide-react";

interface BenchmarkControlBarProps {
  selectedDataset: DocumentDataset;
  onSelectDataset: (dataset: DocumentDataset) => void;
  query: string;
  onChangeQuery: (query: string) => void;
  topK: number;
  onChangeTopK: (topK: number) => void;
  onRetrieveCandidates: () => void;
  isRunning?: boolean;
}

export function BenchmarkControlBar({
  selectedDataset,
  onSelectDataset,
  query,
  onChangeQuery,
  topK,
  onChangeTopK,
  onRetrieveCandidates,
  isRunning = false,
}: BenchmarkControlBarProps) {
  return (
    <section className="bg-canvas-subtle border border-border rounded-lg p-4 sm:p-5 shadow-panel">
      <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
        {/* Dataset Selection */}
        <DatasetSelector
          selectedDataset={selectedDataset}
          onSelectDataset={onSelectDataset}
          disabled={isRunning}
        />

        {/* Query Input */}
        <QueryInput
          query={query}
          onChangeQuery={onChangeQuery}
          onSubmit={onRetrieveCandidates}
          disabled={isRunning}
        />

        {/* Top-K Selector */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-xs font-medium text-text-secondary flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3 text-accent" />
            Top-K
          </label>
          <select
            value={topK}
            onChange={(e) => onChangeTopK(Number(e.target.value))}
            disabled={isRunning}
            className="h-9 rounded bg-surface border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value={3}>Top 3</option>
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={15}>Top 15</option>
            <option value={20}>Top 20</option>
          </select>
        </div>

        {/* Primary Action Button */}
        <div className="w-full md:w-auto shrink-0 pt-2 md:pt-0">
          <Button
            variant="primary"
            size="lg"
            onClick={onRetrieveCandidates}
            disabled={!query.trim() || isRunning}
            isLoading={isRunning}
            className="w-full md:w-auto h-9 px-5 text-xs font-semibold"
          >
            <Search className="h-3.5 w-3.5 mr-1.5" />
            Retrieve Candidates
          </Button>
        </div>
      </div>

      {/* Phase 2 Architecture Banner */}
      <div className="mt-4 pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-accent shrink-0" />
          <span>
            <strong className="text-text-secondary font-medium">Phase 2 Shared Retrieval:</strong>{" "}
            Query embedding vector search produces the candidate pool. The resulting chunks will be passed unchanged to Path A (Cross-Encoder) and Path B (Laya).
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
          <span>Embedding: nomic-embed-text</span>
          <span>•</span>
          <span>Index: Cosine Similarity</span>
        </div>
      </div>
    </section>
  );
}
