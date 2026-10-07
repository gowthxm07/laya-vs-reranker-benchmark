"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BenchmarkControlBar } from "@/components/query/benchmark-control-bar";
import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import { MetricsDashboard } from "@/components/metrics/metrics-dashboard";
import { DesignPatternInspector } from "@/components/patterns/design-pattern-inspector";
import { SAMPLE_DATASETS } from "@/lib/config/datasets";
import { DocumentDataset } from "@/lib/types/dataset";
import { Experiment } from "@/lib/types/experiment";
import { Terminal, Cpu } from "lucide-react";

export default function HomePage() {
  const [selectedDataset, setSelectedDataset] = React.useState<DocumentDataset>(
    SAMPLE_DATASETS[0]
  );
  const [query, setQuery] = React.useState<string>("");
  const [isPatternModalOpen, setIsPatternModalOpen] = React.useState(false);
  const [runNotice, setRunNotice] = React.useState<string | null>(null);

  // Experiment model is initialized in clean 'idle' state. Zero fake numbers!
  const [currentExperiment, setCurrentExperiment] = React.useState<Experiment>({
    id: "exp-init",
    query: "",
    dataset: SAMPLE_DATASETS[0],
    timestamp: Date.now(),
    status: "idle",
    advancedRagResult: {
      pipelineId: "advanced-rag",
      strategyName: "Cross-Encoder Reranker",
      status: "idle",
    },
    layaResult: {
      pipelineId: "laya-rag",
      strategyName: "Laya Relevance Filter",
      status: "idle",
    },
  });

  const handleRunComparison = () => {
    if (!query.trim()) return;

    // In Phase 1, we acknowledge the query and confirm architectural wiring
    // without faking benchmark execution numbers.
    setRunNotice(
      `Query registered: "${query}". Phase 1 architecture validated. ` +
        `Actual execution will be performed in Phase 2 (Cross-Encoder) and Phase 3 (Laya).`
    );

    // Update query in current experiment state while maintaining 'idle' pipeline status
    setCurrentExperiment((prev) => ({
      ...prev,
      query: query.trim(),
      dataset: selectedDataset,
      timestamp: Date.now(),
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text-primary selection:bg-accent-subtle selection:text-accent">
      {/* Global Header */}
      <Header onOpenArchitectureModal={() => setIsPatternModalOpen(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Run Notice Banner if triggered */}
        {runNotice && (
          <div className="p-3 rounded border border-accent/40 bg-accent-subtle/30 text-xs text-text-primary flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent shrink-0" />
              <span>{runNotice}</span>
            </div>
            <button
              onClick={() => setRunNotice(null)}
              className="text-text-muted hover:text-text-primary text-xs font-mono underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Benchmark Control Bar */}
        <BenchmarkControlBar
          selectedDataset={selectedDataset}
          onSelectDataset={(ds) => {
            setSelectedDataset(ds);
            setCurrentExperiment((prev) => ({ ...prev, dataset: ds }));
          }}
          query={query}
          onChangeQuery={setQuery}
          onRunComparison={handleRunComparison}
        />

        {/* 2. Side-by-Side Comparison Workspace */}
        <ComparisonWorkspace experiment={currentExperiment} />

        {/* 3. Differential Metrics Dashboard */}
        <MetricsDashboard experiment={currentExperiment} />

        {/* 4. Architecture Foundation Card */}
        <section className="rounded-lg border border-border bg-surface-elevated/20 p-4 sm:p-5 text-xs">
          <div className="flex items-center gap-2 text-text-secondary font-medium mb-2">
            <Cpu className="h-4 w-4 text-accent" />
            <h3 className="text-text-primary font-semibold">
              Phase 1 Architectural Principles
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-text-muted leading-relaxed">
            <div>
              <strong className="text-text-secondary block mb-0.5">
                1. Fair Experimental Isolation
              </strong>
              Both Path A and Path B evaluate the identical candidate chunk pool retrieved for the user query, using the same downstream generation model (llama3.2:3b).
            </div>
            <div>
              <strong className="text-text-secondary block mb-0.5">
                2. Replaceable Relevance Strategies
              </strong>
              No hardcoded post-retrieval logic. Relevance evaluations adhere to the Strategy pattern (`RelevanceEvaluator`), allowing swap-in of Cross-Encoders, Laya, or custom evaluators.
            </div>
            <div>
              <strong className="text-text-secondary block mb-0.5">
                3. Pure Telemetry & Traceability
              </strong>
              Zero fake benchmark metrics. The Observer pattern traces pipeline events, recording exact step latencies and retained/discarded chunk audits.
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Software Design Patterns Inspector Modal */}
      <DesignPatternInspector
        isOpen={isPatternModalOpen}
        onClose={() => setIsPatternModalOpen(false)}
      />
    </div>
  );
}
