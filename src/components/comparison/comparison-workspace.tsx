"use client";

import * as React from "react";
import { Experiment } from "@/lib/types/experiment";
import { PipelinePanel } from "./pipeline-panel";
import { EVALUATOR_STRATEGIES } from "@/lib/config/evaluator-strategies";
import { GitCompare, Scale } from "lucide-react";

interface ComparisonWorkspaceProps {
  experiment?: Experiment | null;
}

export function ComparisonWorkspace({
  experiment,
}: ComparisonWorkspaceProps) {
  const advancedResult = experiment?.advancedRagResult;
  const layaResult = experiment?.layaResult;

  return (
    <section className="space-y-3">
      {/* Workspace Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Comparison Workspace
          </h2>
          <span className="text-xs text-text-muted">•</span>
          <span className="text-xs text-text-secondary">
            Side-by-Side Strategy Evaluation
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-text-muted font-mono">
          <span className="flex items-center gap-1">
            <Scale className="h-3 w-3 text-text-secondary" />
            Fair Benchmark: Identical Candidate Chunks & Downstream Model
          </span>
        </div>
      </div>

      {/* Side-by-Side Dual Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PATH A: Advanced RAG */}
        <PipelinePanel
          pipelineId="advanced-rag"
          title="Path A — Advanced RAG"
          strategyName={EVALUATOR_STRATEGIES["cross-encoder"].name}
          strategyDescription={EVALUATOR_STRATEGIES["cross-encoder"].description}
          patternRole="Strategy: CrossEncoderEvaluator"
          result={advancedResult}
        />

        {/* PATH B: Laya RAG */}
        <PipelinePanel
          pipelineId="laya-rag"
          title="Path B — Laya RAG"
          strategyName={EVALUATOR_STRATEGIES["laya"].name}
          strategyDescription={EVALUATOR_STRATEGIES["laya"].description}
          patternRole="Strategy + Adapter: LayaEvaluator"
          result={layaResult}
        />
      </div>
    </section>
  );
}
