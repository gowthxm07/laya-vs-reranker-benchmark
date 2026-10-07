"use client";

import * as React from "react";
import { Experiment } from "@/lib/types/experiment";
import { CandidateChunkPool } from "@/lib/types/candidate-pool";
import { ComparisonResult, ComparisonMode } from "@/lib/types/comparison";
import { PipelinePanel } from "./pipeline-panel";
import { ContextViewerModal } from "./context-viewer-modal";
import { EVALUATOR_STRATEGIES } from "@/lib/config/evaluator-strategies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  GitCompare,
  Scale,
  Sparkles,
  Loader2,
  Eye,
  Sliders,
} from "lucide-react";

interface ComparisonWorkspaceProps {
  experiment?: Experiment | null;
  candidatePool?: CandidateChunkPool | null;
  comparisonResult?: ComparisonResult | null;
  onRunComparison?: (
    mode: ComparisonMode,
    topN: number,
    maxContextChunks: number
  ) => void;
  isComparing?: boolean;
}

export function ComparisonWorkspace({
  experiment,
  candidatePool,
  comparisonResult,
  onRunComparison,
  isComparing = false,
}: ComparisonWorkspaceProps) {
  const [mode, setMode] = React.useState<ComparisonMode>("native");
  const [topN, setTopN] = React.useState<number>(5);
  const [maxContextChunks, setMaxContextChunks] = React.useState<number>(5);
  const [contextModalPath, setContextModalPath] = React.useState<
    "a" | "b" | null
  >(null);

  const advancedResult = experiment?.advancedRagResult;
  const layaResult = experiment?.layaResult;
  const hasCandidates =
    candidatePool && candidatePool.candidateChunks.length > 0;

  const handleRunClick = () => {
    if (onRunComparison && hasCandidates) {
      onRunComparison(mode, topN, maxContextChunks);
    }
  };

  return (
    <section className="space-y-4">
      {/* Workspace Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Comparison Workspace
          </h2>
          <span className="text-xs text-text-muted">•</span>
          <span className="text-xs text-text-secondary">
            Phase 5: Same-LLM Controlled Benchmark
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-text-muted font-mono">
          <span className="flex items-center gap-1">
            <Scale className="h-3 w-3 text-text-secondary" />
            Downstream LLM: <strong className="text-text-primary">llama3.2:3b</strong> (Ollama)
          </span>
        </div>
      </div>

      {/* Benchmark Controls Card */}
      <Card className="p-4 bg-surface border border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold text-text-primary">
                Comparison Mode & Constraints
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Native Mode Option */}
              <button
                type="button"
                onClick={() => setMode("native")}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  mode === "native"
                    ? "bg-accent-subtle/80 border-accent text-blue-300 font-medium"
                    : "bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary"
                }`}
              >
                Native Strategy Mode
              </button>

              {/* Context-Budget Mode Option */}
              <button
                type="button"
                onClick={() => setMode("context-budget")}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  mode === "context-budget"
                    ? "bg-accent-subtle/80 border-accent text-blue-300 font-medium"
                    : "bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary"
                }`}
              >
                Context-Budget Mode
              </button>

              {/* Budget / Top-N inputs */}
              {mode === "context-budget" ? (
                <div className="flex items-center gap-1.5 ml-2 text-xs font-mono text-text-secondary">
                  <span>Max Budget:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxContextChunks}
                    onChange={(e) =>
                      setMaxContextChunks(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-14 px-2 py-1 text-xs rounded border border-border bg-canvas text-text-primary font-mono"
                  />
                  <span className="text-[11px] text-text-muted">chunks</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 ml-2 text-xs font-mono text-text-secondary">
                  <span>Top-N (Cross-Encoder):</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={topN}
                    onChange={(e) =>
                      setTopN(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-14 px-2 py-1 text-xs rounded border border-border bg-canvas text-text-primary font-mono"
                  />
                </div>
              )}
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {mode === "native"
                ? "Native mode: Cross-Encoder selects Top-N while Laya retains all KEEP candidates without artificial truncation."
                : `Context-Budget mode: Enforces a maximum context budget of ${maxContextChunks} chunks. If Laya KEEP chunks exceed budget, initial retrieval order is preserved deterministically.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {onRunComparison && (
              <Button
                onClick={handleRunClick}
                disabled={!hasCandidates || isComparing}
                className="gap-2 bg-accent hover:bg-accent-emphasis text-white font-medium"
              >
                {isComparing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Running Comparison...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Run Head-to-Head Comparison
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Comparison Summary Banner (when comparison result is available) */}
      {comparisonResult && (
        <Card className="p-3.5 bg-surface-elevated/40 border border-border space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
            <div className="flex items-center gap-2">
              <Badge variant="accent" size="sm">
                Mode: {comparisonResult.mode}
              </Badge>
              <Badge variant="outline" size="sm">
                Model: {comparisonResult.llmModel}
              </Badge>
              <span className="text-[11px] text-text-muted font-mono">
                Wall-Clock Execution:{" "}
                <strong className="text-text-primary">
                  {comparisonResult.overallLatencyMs} ms
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContextModalPath("a")}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              >
                <Eye className="h-3 w-3 text-accent" /> Context A ({comparisonResult.crossEncoder.retainedCount})
              </button>
              <button
                type="button"
                onClick={() => setContextModalPath("b")}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
              >
                <Eye className="h-3 w-3 text-emerald-400" /> Context B ({comparisonResult.laya.retainedCount})
              </button>
            </div>
          </div>

          {/* Quick Metrics Comparison Table */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-canvas-subtle/80 border border-border/40 space-y-1">
              <span className="text-[10px] uppercase text-text-muted block">
                Chunks Selected
              </span>
              <div className="flex items-center justify-between text-text-primary">
                <span>Adv: <strong>{comparisonResult.crossEncoder.retainedCount}</strong></span>
                <span>Laya: <strong>{comparisonResult.laya.retainedCount}</strong></span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-canvas-subtle/80 border border-border/40 space-y-1">
              <span className="text-[10px] uppercase text-text-muted block">
                Relevance Latency
              </span>
              <div className="flex items-center justify-between text-text-primary">
                <span>Adv: <strong>{comparisonResult.crossEncoder.relevanceLatencyMs} ms</strong></span>
                <span>Laya: <strong>{comparisonResult.laya.relevanceLatencyMs} ms</strong></span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-canvas-subtle/80 border border-border/40 space-y-1">
              <span className="text-[10px] uppercase text-text-muted block">
                LLM Generation Latency
              </span>
              <div className="flex items-center justify-between text-text-primary">
                <span>Adv: <strong>{comparisonResult.crossEncoder.generationLatencyMs} ms</strong></span>
                <span>Laya: <strong>{comparisonResult.laya.generationLatencyMs} ms</strong></span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-canvas-subtle/80 border border-border/40 space-y-1">
              <span className="text-[10px] uppercase text-text-muted block">
                Total Path Latency
              </span>
              <div className="flex items-center justify-between text-text-primary">
                <span>Adv: <strong>{comparisonResult.crossEncoder.totalLatencyMs} ms</strong></span>
                <span>Laya: <strong>{comparisonResult.laya.totalLatencyMs} ms</strong></span>
              </div>
            </div>
          </div>
        </Card>
      )}

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

      {/* Context Viewer Modals */}
      {comparisonResult && (
        <>
          <ContextViewerModal
            isOpen={contextModalPath === "a"}
            onClose={() => setContextModalPath(null)}
            strategyTitle="Path A — Advanced RAG (Cross-Encoder)"
            chunks={comparisonResult.crossEncoder.selectedChunks}
            contextText={comparisonResult.crossEncoder.contextText}
          />
          <ContextViewerModal
            isOpen={contextModalPath === "b"}
            onClose={() => setContextModalPath(null)}
            strategyTitle="Path B — Laya RAG (Relevance Filter)"
            chunks={comparisonResult.laya.selectedChunks}
            contextText={comparisonResult.laya.contextText}
          />
        </>
      )}
    </section>
  );
}
