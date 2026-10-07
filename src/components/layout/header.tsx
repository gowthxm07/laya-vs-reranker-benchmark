"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, GitBranch, Layers, ExternalLink } from "lucide-react";

interface HeaderProps {
  onOpenArchitectureModal: () => void;
}

export function Header({ onOpenArchitectureModal }: HeaderProps) {
  return (
    <header className="border-b border-border bg-canvas/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Title & Tagline */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-8 w-8 rounded border border-border bg-surface-elevated flex items-center justify-center shrink-0 text-accent">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-text-primary">
                PatternRAG Lab
              </h1>
              <span className="text-xs text-text-muted hidden sm:inline">•</span>
              <span className="text-xs font-medium text-text-secondary hidden sm:inline">
                Laya vs Advanced RAG Benchmark
              </span>
              <Badge variant="accent" size="sm">
                Phase 1 Foundation
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Compare post-retrieval relevance evaluation strategies on identical candidate chunks.
            </p>
          </div>
        </div>

        {/* Technical Badges & Architecture Modal Trigger */}
        <div className="flex items-center flex-wrap gap-2 pt-1 md:pt-0">
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded border border-border/60 bg-surface-subtle text-[11px] text-text-muted font-mono">
            <Cpu className="h-3 w-3 text-text-secondary" />
            <span>LLM Target:</span>
            <span className="text-text-primary">llama3.2:3b</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenArchitectureModal}
            className="text-xs"
          >
            <GitBranch className="h-3.5 w-3.5 text-accent mr-1" />
            Design Patterns (6)
          </Button>

          <a
            href="https://github.com/gowthxm07/laya-vs-reranker-benchmark"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1"
          >
            <span>GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </header>
  );
}
