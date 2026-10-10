"use client";

import * as React from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SecurityExperimentSection } from "@/components/security/security-experiment-section";
import { SecurityBenchmarkView } from "@/components/security/security-benchmark-view";
import { Shield, ArrowLeft, Sliders, BarChart3 } from "lucide-react";

export default function SecurityExperimentPage() {
  const [activeTab, setActiveTab] = React.useState<"interactive" | "benchmark">("interactive");

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text-primary selection:bg-accent-subtle selection:text-accent">
      {/* Global Minimal Header */}
      <Header activeTab="security" />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Interactive Lab</span>
          </Link>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-surface border border-border text-text-muted">
            Dedicated Security Research Mode
          </span>
        </div>

        {/* Page Hero Description */}
        <div className="space-y-1 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Security Guardrail RAG Comparison & Benchmark
            </h1>
          </div>
          <p className="text-xs text-text-muted max-w-4xl leading-relaxed">
            End-to-end evaluation comparing <strong>Path A</strong> (Cross-Encoder RAG + Conventional Guardrails) against <strong>Path B</strong> (Laya RAG + Security System Instructions Only) on live retrieved documents. Investigates whether relevance filtering combined with role instructions can protect sensitive records without application-level guardrails.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("interactive")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "interactive"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Interactive Comparison</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("benchmark")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "benchmark"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Security Benchmark Suite</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "interactive" ? (
          <SecurityExperimentSection standalone />
        ) : (
          <SecurityBenchmarkView />
        )}
      </main>

      {/* Global Minimal Footer */}
      <Footer />
    </div>
  );
}
