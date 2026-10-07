"use client";

import * as React from "react";
import { DocumentDataset } from "@/lib/types/dataset";
import { SAMPLE_DATASETS } from "@/lib/config/datasets";
import { Database, FileText } from "lucide-react";

interface DatasetSelectorProps {
  selectedDataset: DocumentDataset;
  onSelectDataset: (dataset: DocumentDataset) => void;
  disabled?: boolean;
}

export function DatasetSelector({
  selectedDataset,
  onSelectDataset,
  disabled = false,
}: DatasetSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full md:w-80 shrink-0">
      <label className="text-xs font-medium text-text-secondary flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-accent" />
          Evaluation Corpus / Dataset
        </span>
        <span className="text-[10px] text-text-muted font-mono">
          {selectedDataset.documentCount} docs / {selectedDataset.totalChunks.toLocaleString()} chunks
        </span>
      </label>

      <div className="relative">
        <select
          value={selectedDataset.id}
          disabled={disabled}
          onChange={(e) => {
            const found = SAMPLE_DATASETS.find((d) => d.id === e.target.value);
            if (found) onSelectDataset(found);
          }}
          className="w-full h-9 rounded bg-surface border border-border px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent transition-colors cursor-pointer appearance-none pr-8"
        >
          {SAMPLE_DATASETS.map((ds) => (
            <option key={ds.id} value={ds.id} className="bg-surface text-text-primary">
              {ds.name} ({ds.totalChunks} chunks)
            </option>
          ))}
        </select>
        <div className="absolute right-2.5 top-2.5 pointer-events-none text-text-muted">
          <FileText className="h-4 w-4" />
        </div>
      </div>

      <p className="text-[11px] text-text-muted line-clamp-1">
        {selectedDataset.description}
      </p>
    </div>
  );
}
