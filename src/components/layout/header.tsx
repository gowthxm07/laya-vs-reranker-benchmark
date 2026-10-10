"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Shield } from "lucide-react";

export type ActiveNavTab = "lab" | "benchmark" | "history" | "security";

interface HeaderProps {
  activeTab: ActiveNavTab;
  onTabChange?: (tab: "lab" | "benchmark" | "history") => void;
  onOpenArchitectureModal?: () => void;
}

export function Header({
  activeTab,
  onTabChange,
}: HeaderProps) {
  return (
    <header className="border-b border-border bg-white sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        {/* Title and Subtitle */}
        <div>
          {activeTab === "security" ? (
            <Link
              href="/"
              className="text-base font-semibold tracking-tight text-text-primary hover:text-accent transition-colors text-left"
            >
              PatternRAG Lab
            </Link>
          ) : (
            <button
              onClick={() => onTabChange?.("lab")}
              className="text-base font-semibold tracking-tight text-text-primary hover:text-accent transition-colors text-left"
            >
              PatternRAG Lab
            </button>
          )}
          <p className="text-xs text-text-muted mt-0.5">
            Cross-Encoder vs Laya Relevance Evaluation
          </p>
        </div>

        {/* Minimal Secondary Navigation */}
        <nav className="flex items-center gap-3.5 sm:gap-5 text-xs">
          {activeTab === "security" ? (
            <Link
              href="/"
              className="text-accent hover:underline font-medium transition-colors"
            >
              ← Interactive Lab
            </Link>
          ) : activeTab !== "lab" ? (
            <button
              onClick={() => onTabChange?.("lab")}
              className="text-accent hover:underline font-medium transition-colors"
            >
              ← Interactive Lab
            </button>
          ) : null}

          {activeTab === "security" ? (
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              Benchmark
            </Link>
          ) : (
            <button
              onClick={() => onTabChange?.("benchmark")}
              className={`transition-colors ${
                activeTab === "benchmark"
                  ? "text-accent font-semibold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Benchmark
            </button>
          )}

          {activeTab === "security" ? (
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              History
            </Link>
          ) : (
            <button
              onClick={() => onTabChange?.("history")}
              className={`transition-colors ${
                activeTab === "history"
                  ? "text-accent font-semibold"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              History
            </button>
          )}

          {/* Dedicated Security Guardrail Experiment Nav Item */}
          <Link
            href="/security-experiment"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "security"
                ? "bg-accent text-white font-medium shadow-xs"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-border/80"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Security Guardrail Experiment</span>
          </Link>

          <a
            href="https://github.com/gowthxm07/laya-vs-reranker-benchmark"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors hidden sm:inline-flex"
          >
            <span>GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </nav>
      </div>
    </header>
  );
}
