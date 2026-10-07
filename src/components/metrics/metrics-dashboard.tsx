"use client";

import * as React from "react";
import { Experiment } from "@/lib/types/experiment";
import { MetricCard } from "./metric-card";
import {
  formatLatency,
  formatTokens,
  formatPercentage,
} from "@/lib/utils/formatters";
import {
  Clock,
  Coins,
  Layers,
  Percent,
  Cpu,
  Award,
  BarChart3,
} from "lucide-react";

interface MetricsDashboardProps {
  experiment?: Experiment | null;
}

export function MetricsDashboard({ experiment }: MetricsDashboardProps) {
  const adv = experiment?.advancedRagResult;
  const laya = experiment?.layaResult;

  // Latency metrics
  const advLatency = adv?.totalLatencyMs !== undefined ? formatLatency(adv.totalLatencyMs) : "—";
  const layaLatency = laya?.totalLatencyMs !== undefined ? formatLatency(laya.totalLatencyMs) : "—";

  // Evaluator-only latency
  const advEvalLatency =
    adv?.relevanceEvaluationLatencyMs !== undefined
      ? formatLatency(adv.relevanceEvaluationLatencyMs)
      : "—";
  const layaEvalLatency =
    laya?.relevanceEvaluationLatencyMs !== undefined
      ? formatLatency(laya.relevanceEvaluationLatencyMs)
      : "—";

  // Token metrics
  const advTokens = adv?.totalTokens !== undefined ? formatTokens(adv.totalTokens) : "—";
  const layaTokens = laya?.totalTokens !== undefined ? formatTokens(laya.totalTokens) : "—";

  // Chunk retention
  const advRetained =
    adv?.candidateChunkCount !== undefined && adv?.retainedChunkCount !== undefined
      ? `${adv.retainedChunkCount} / ${adv.candidateChunkCount}`
      : "—";
  const layaRetained =
    laya?.candidateChunkCount !== undefined && laya?.retainedChunkCount !== undefined
      ? `${laya.retainedChunkCount} / ${laya.candidateChunkCount}`
      : "—";

  // Context reduction rate
  const advReduction =
    adv?.metrics?.contextReductionRate !== undefined
      ? formatPercentage(adv.metrics.contextReductionRate)
      : "—";
  const layaReduction =
    laya?.metrics?.contextReductionRate !== undefined
      ? formatPercentage(laya.metrics.contextReductionRate)
      : "—";

  // Quality metric placeholder
  const advQuality =
    adv?.metrics?.faithfulnessScore !== undefined
      ? adv.metrics.faithfulnessScore.toFixed(2)
      : "—";
  const layaQuality =
    laya?.metrics?.faithfulnessScore !== undefined
      ? laya.metrics.faithfulnessScore.toFixed(2)
      : "—";

  return (
    <section className="space-y-3">
      {/* Metrics Section Title */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Benchmark Metrics
          </h2>
          <span className="text-xs text-text-muted">•</span>
          <span className="text-xs text-text-secondary">
            Differential Performance Summary
          </span>
        </div>

        <span className="text-[11px] font-mono text-text-muted">
          State: No experiment yet
        </span>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Metric 1: Total Latency */}
        <MetricCard
          title="End-to-End Latency"
          description="Total execution time from query to answer"
          icon={Clock}
          pathAValue={advLatency}
          pathBValue={layaLatency}
        />

        {/* Metric 2: Relevance Evaluator Latency */}
        <MetricCard
          title="Evaluator Latency"
          description="Isolated reranking / filtering stage duration"
          icon={Cpu}
          pathAValue={advEvalLatency}
          pathBValue={layaEvalLatency}
        />

        {/* Metric 3: Token Consumption */}
        <MetricCard
          title="Tokens Consumed"
          description="Total prompt context and completion tokens"
          icon={Coins}
          pathAValue={advTokens}
          pathBValue={layaTokens}
        />

        {/* Metric 4: Chunks Retained */}
        <MetricCard
          title="Retained Chunks"
          description="Kept passages vs total candidate pool"
          icon={Layers}
          pathAValue={advRetained}
          pathBValue={layaRetained}
        />

        {/* Metric 5: Context Reduction */}
        <MetricCard
          title="Context Reduction"
          description="Percentage of candidate noise pruned"
          icon={Percent}
          pathAValue={advReduction}
          pathBValue={layaReduction}
        />

        {/* Metric 6: Answer Faithfulness */}
        <MetricCard
          title="Answer Quality"
          description="Faithfulness score (LLM-as-a-judge)"
          icon={Award}
          pathAValue={advQuality}
          pathBValue={layaQuality}
        />
      </div>
    </section>
  );
}
