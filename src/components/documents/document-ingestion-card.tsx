"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Document } from "@/lib/types/document";
import { AlertCircle } from "lucide-react";

interface IngestionTimings {
  parseDurationMs: number;
  chunkDurationMs: number;
  embeddingDurationMs: number;
  indexingDurationMs: number;
  totalDurationMs: number;
}

interface DocumentIngestionCardProps {
  onDocumentIngested: (doc: Document, chunkCount: number) => void;
  onClearIndex?: () => void;
  indexedDoc?: Document | null;
  totalChunks?: number;
}

export function DocumentIngestionCard({
  onDocumentIngested,
  onClearIndex,
  indexedDoc,
  totalChunks = 0,
}: DocumentIngestionCardProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastTimings, setLastTimings] = React.useState<IngestionTimings | null>(
    null
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to ingest document.");
      }

      setLastTimings(data.timings);
      onDocumentIngested(data.document, data.chunkCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to ingest document.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear indexed document from vector store?")) return;
    try {
      await fetch("/api/documents", { method: "DELETE" });
      setLastTimings(null);
      if (onClearIndex) onClearIndex();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to clear vector store.");
    }
  };

  const isReady = !!indexedDoc || totalChunks > 0;

  return (
    <section className="space-y-3">
      {/* Section Header */}
      <div>
        <h2 className="text-xs font-mono font-semibold tracking-wider text-accent uppercase">
          01 — DOCUMENT
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Upload the document you want to evaluate.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded border border-status-error/30 bg-rose-50 text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-status-error" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs text-rose-600 hover:text-rose-900 underline shrink-0 font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {isReady ? (
        /* Document Uploaded / Ready View */
        <div className="border border-border rounded-lg p-5 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-text-primary">
                {indexedDoc?.filename || "demo_document.pdf"}
              </div>
              <div className="text-xs text-text-muted flex items-center gap-2">
                {indexedDoc?.pageCount ? (
                  <span>{indexedDoc.pageCount} pages</span>
                ) : (
                  <span>Document parsed</span>
                )}
                <span>·</span>
                <span className="text-emerald-700 font-medium">Uploaded / Ready</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.markdown"
                onChange={handleFileChange}
                className="hidden"
                id="doc-upload-replace"
                disabled={isUploading}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={isUploading}
                isLoading={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                Replace File
              </Button>
              {onClearIndex && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={isUploading}
                  className="text-xs text-text-muted hover:text-status-error hover:border-status-error/50"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Unobtrusive Technical Details */}
          <details className="text-xs text-text-muted pt-2 border-t border-border/60">
            <summary className="cursor-pointer hover:text-text-primary select-none font-mono text-[11px]">
              Technical details
            </summary>
            <div className="mt-2 space-y-1 font-mono text-[11px] text-text-secondary pl-2">
              <div>Total Indexed Chunks: {totalChunks}</div>
              {indexedDoc && <div>Document ID: {indexedDoc.id}</div>}
              {lastTimings && (
                <div>
                  Ingestion Latency: {lastTimings.totalDurationMs}ms (Parse: {lastTimings.parseDurationMs}ms, Chunk: {lastTimings.chunkDurationMs}ms, Embed: {lastTimings.embeddingDurationMs}ms)
                </div>
              )}
            </div>
          </details>
        </div>
      ) : (
        /* Empty Upload Dropzone View */
        <div className="border border-dashed border-border rounded-lg p-10 bg-white hover:bg-surface-elevated/40 text-center transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown"
            onChange={handleFileChange}
            className="hidden"
            id="doc-upload-input"
            disabled={isUploading}
          />
          <div className="max-w-xs mx-auto space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-text-primary">
                {isUploading
                  ? "Parsing, chunking & embedding document..."
                  : "Upload your document"}
              </div>
              <div className="text-xs text-text-muted">
                PDF, TXT or Markdown
              </div>
            </div>
            <div>
              <Button
                variant="secondary"
                size="md"
                disabled={isUploading}
                isLoading={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
              >
                Choose File
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
