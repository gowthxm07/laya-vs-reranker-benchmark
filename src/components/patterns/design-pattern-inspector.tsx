"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface DesignPatternInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PatternInfo {
  name: string;
  category: "Behavioral" | "Structural" | "Creational";
  role: string;
  interfaces: string[];
  implementations: string[];
  rationale: string;
}

const PATTERNS: PatternInfo[] = [
  {
    name: "Strategy Pattern",
    category: "Behavioral",
    role: "Interchangeable post-retrieval relevance evaluation algorithms",
    interfaces: ["RelevanceEvaluator", "RelevanceEvaluationRequest", "RelevanceEvaluationResult"],
    implementations: ["CrossEncoderEvaluator", "LayaEvaluator", "SimilarityThresholdEvaluator"],
    rationale:
      "Decouples the RAG orchestrator from specific reranking libraries. Both Advanced RAG (cross-encoders) and Laya RAG conform to the same interface so evaluation is controlled and fair.",
  },
  {
    name: "Adapter Pattern",
    category: "Structural",
    role: "Decoupling external Laya API contracts from internal domain models",
    interfaces: ["ILayaAdapter", "LayaRawPayload", "LayaRawResponse"],
    implementations: ["LayaAdapter"],
    rationale:
      "Prevents hardcoding Laya-specific payloads or HTTP shapes across the codebase. Translates domain Chunk objects to Laya requests and adapts scoring back to domain Chunk decisions.",
  },
  {
    name: "Factory Pattern",
    category: "Creational",
    role: "Dynamic instantiation of evaluators and LLM providers",
    interfaces: ["EvaluatorFactory", "LLMProviderFactory"],
    implementations: ["EvaluatorFactory.createEvaluator()", "LLMProviderFactory.createProvider()"],
    rationale:
      "Allows the benchmark runner to instantiate the active strategy ('cross-encoder' vs 'laya') and LLM host (Ollama vs OpenRouter) dynamically without coupling UI or callers to concrete classes.",
  },
  {
    name: "Facade Pattern",
    category: "Structural",
    role: "Unified high-level entrypoint for multi-stage RAG workflow",
    interfaces: ["IRAGOrchestratorFacade", "RunBenchmarkRequest"],
    implementations: ["RAGOrchestratorFacade"],
    rationale:
      "Hides the complex coordination of vector retrieval, relevance strategy execution, token-budget context assembly, and LLM generation behind a clean high-level method executePipeline().",
  },
  {
    name: "Builder Pattern",
    category: "Creational",
    role: "Fluent prompt construction and token-budget context serialization",
    interfaces: ["IContextBuilder", "IPromptBuilder"],
    implementations: ["ContextBuilder", "PromptBuilder"],
    rationale:
      "Separates complex passage ordering, metadata labeling, token budgeting, and system instruction constraints from the orchestrator, ensuring deterministic prompts across runs.",
  },
  {
    name: "Observer Pattern",
    category: "Behavioral",
    role: "Decoupled pipeline lifecycle telemetry and decision trace recording",
    interfaces: ["IPipelineObserver", "IObservablePipeline", "PipelineNotification"],
    implementations: ["ObservablePipelineSubject", "TraceRecorderObserver"],
    rationale:
      "Enables timing profiling, trace recording, and metric calculation without polluting core RAG pipeline algorithms with telemetry side-effects.",
  },
];

export function DesignPatternInspector({
  isOpen,
  onClose,
}: DesignPatternInspectorProps) {
  const [selectedPattern, setSelectedPattern] = React.useState<PatternInfo>(
    PATTERNS[0]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Software Design Patterns Architecture"
      description="PatternRAG Lab is structured around 6 classical software design patterns ensuring modularity and low coupling."
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Pattern List */}
        <div className="md:col-span-5 flex flex-col gap-1.5 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-3">
          {PATTERNS.map((p) => {
            const isSelected = selectedPattern.name === p.name;
            return (
              <button
                key={p.name}
                onClick={() => setSelectedPattern(p)}
                className={`text-left p-2.5 rounded text-xs transition-colors flex items-center justify-between group ${
                  isSelected
                    ? "bg-accent-subtle border border-accent-border text-text-primary"
                    : "hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-transparent"
                }`}
              >
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {p.category} Pattern
                  </div>
                </div>
                <ArrowRight
                  className={`h-3 w-3 transition-transform ${
                    isSelected
                      ? "text-accent translate-x-0.5"
                      : "text-text-muted group-hover:translate-x-0.5"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Details Panel */}
        <div className="md:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {selectedPattern.name}
            </h3>
            <Badge variant="accent" size="sm">
              {selectedPattern.category}
            </Badge>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            {selectedPattern.role}
          </p>

          <div className="p-3 rounded bg-canvas-subtle border border-border space-y-2">
            <span className="text-[11px] font-mono text-text-muted uppercase font-semibold block">
              Architectural Rationale
            </span>
            <p className="text-xs text-text-secondary leading-relaxed">
              {selectedPattern.rationale}
            </p>
          </div>

          <div className="space-y-2 mt-1">
            <span className="text-[11px] font-mono text-text-muted uppercase font-semibold block">
              Contract Interfaces
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedPattern.interfaces.map((i) => (
                <Badge key={i} variant="outline" size="sm" className="font-mono text-[11px]">
                  {i}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2 mt-1">
            <span className="text-[11px] font-mono text-text-muted uppercase font-semibold block">
              Implementations / Classes
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedPattern.implementations.map((impl) => (
                <Badge key={impl} variant="muted" size="sm" className="font-mono text-[11px]">
                  {impl}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
