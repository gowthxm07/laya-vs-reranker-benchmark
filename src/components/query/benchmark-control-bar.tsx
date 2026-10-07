"use client";

import * as React from "react";
import { DocumentDataset } from "@/lib/types/dataset";
import { DatasetSelector } from "./dataset-selector";
import { QueryInput } from "./query-input";
import { Button } from "@/components/ui/button";
import { Play, Info } from "lucide-react";

interface BenchmarkControlBarProps {
  selectedDataset: DocumentDataset;
  onSelectDataset: (dataset: DocumentDataset) => void;
  query: string;
  onChangeQuery: (query: string) => void;
  onRunComparison: () => void;
  isRunning?: boolean;
}

export function BenchmarkControlBar({
  selectedDataset,
  onSelectDataset,
  query,
  onChangeQuery,
  onRunComparison,
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
          onSubmit={onRunComparison}
          disabled={isRunning}
        />

        {/* Primary Action Button */}
        <div className="w-full md:w-auto shrink-0 pt-2 md:pt-0">
          <Button
            variant="primary"
            size="lg"
            onClick={onRunComparison}
            disabled={!query.trim() || isRunning}
            isLoading={isRunning}
            className="w-full md:w-auto h-9 px-5 text-xs font-semibold"
          >
            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
            Run Comparison
          </Button>
        </div>
      </div>

      {/* Phase 1 Status Banner */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-accent shrink-0" />
          <span>
            <strong className="text-text-secondary font-medium">Phase 1 Architecture Shell:</strong>{" "}
            Pipeline contracts, strategy abstractions, and design tokens are established. Backend execution triggers in Phase 2 (Advanced RAG) & Phase 3 (Laya).
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px]">
          <span>Strategy: Dual-Path</span>
          <span>•</span>
          <span>Candidate Chunks: Shared</span>
        </div>
      </div>
    </section>
  );
}
