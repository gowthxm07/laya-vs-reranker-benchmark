"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Chunk } from "@/lib/types/chunk";
import { FileText, Copy, Check, Hash } from "lucide-react";

interface ContextViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyTitle: string;
  chunks: Chunk[];
  contextText: string;
}

export function ContextViewerModal({
  isOpen,
  onClose,
  strategyTitle,
  chunks,
  contextText,
}: ContextViewerModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!contextText) return;
    navigator.clipboard.writeText(contextText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Context Sent to LLM — ${strategyTitle}`}
      description={`Exact passages provided to Ollama llama3.2:3b for generation (${chunks.length} chunks, ${contextText.length} characters)`}
      className="max-w-4xl"
    >
      <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
        {/* Quick Toolbar */}
        <div className="flex items-center justify-between bg-canvas-subtle p-2.5 rounded border border-border text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" size="sm">
              {chunks.length} Passages
            </Badge>
            <Badge variant="outline" size="sm">
              {contextText.length} Characters
            </Badge>
            <Badge variant="outline" size="sm">
              ~{Math.ceil(contextText.length / 4)} Tokens
            </Badge>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy Full Context
              </>
            )}
          </button>
        </div>

        {/* Chunks List */}
        {chunks.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-border/80 rounded bg-canvas-subtle/40">
            <FileText className="h-8 w-8 text-text-muted mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium text-text-secondary">
              No context chunks were retained for this strategy
            </p>
            <p className="text-[11px] text-text-muted mt-1 max-w-sm mx-auto">
              The downstream LLM was prompted with an explicit empty-context notification indicating insufficient retrieved evidence.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {chunks.map((chunk, idx) => (
              <div
                key={chunk.id || idx}
                className="p-3.5 rounded border border-border bg-surface-elevated/40 text-xs flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-accent font-semibold flex items-center gap-0.5">
                      <Hash className="h-3 w-3" /> {idx + 1}
                    </span>
                    <span className="font-medium text-text-primary">
                      {chunk.source || chunk.documentId}
                    </span>
                    {chunk.pageNumber !== undefined && (
                      <span className="text-[10px] text-text-muted font-mono">
                        Page {chunk.pageNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-muted">
                      ID: {chunk.id}
                    </span>
                    {chunk.retrievalScore !== undefined && (
                      <Badge variant="outline" size="sm">
                        Retr: {chunk.retrievalScore.toFixed(3)}
                      </Badge>
                    )}
                    {chunk.relevanceScore !== undefined && (
                      <Badge variant="accent" size="sm">
                        Rel: {chunk.relevanceScore.toFixed(3)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-text-secondary leading-relaxed bg-canvas-subtle/80 p-2.5 rounded border border-border/30 whitespace-pre-wrap">
                  {chunk.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
