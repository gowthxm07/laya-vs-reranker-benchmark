"use client";

import * as React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Document } from "@/lib/types/document";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";

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
    if (!confirm("Clear indexed documents from vector store?")) return;
    try {
      await fetch("/api/documents", { method: "DELETE" });
      setLastTimings(null);
      if (onClearIndex) onClearIndex();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to clear vector store.");
    }
  };

  return (
    <Card className="bg-canvas-subtle border border-border rounded-lg shadow-panel">
      <CardHeader className="p-4 border-b border-border/80 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Document Ingestion & Vector Index
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="accent" size="sm" className="font-mono">
            Embedding: nomic-embed-text
          </Badge>
          {totalChunks > 0 && (
            <button
              onClick={handleClear}
              className="text-text-muted hover:text-status-error p-1 rounded transition-colors"
              title="Clear vector store"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Dropzone / Upload Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown"
            onChange={handleFileChange}
            className="hidden"
            id="doc-upload-input"
            disabled={isUploading}
          />
          <label
            htmlFor="doc-upload-input"
            className={`flex-1 flex items-center justify-center gap-2.5 p-3 rounded border border-dashed border-border/90 bg-surface/50 hover:bg-surface-elevated/70 text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-colors ${
              isUploading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Upload className="h-4 w-4 text-accent shrink-0" />
            <span>
              {isUploading
                ? "Parsing, chunking & embedding document..."
                : "Drop or select PDF, TXT, or Markdown document"}
            </span>
          </label>

          <Button
            variant="secondary"
            size="md"
            disabled={isUploading}
            isLoading={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs shrink-0"
          >
            Choose File
          </Button>
        </div>

        {error && (
          <div className="p-2.5 rounded border border-status-error/40 bg-status-error/10 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Document Status Card */}
        {indexedDoc ? (
          <div className="p-3 rounded border border-border/80 bg-surface-elevated/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary">
                    {indexedDoc.filename}
                  </span>
                  <Badge variant="success" size="sm" className="gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Indexed
                  </Badge>
                </div>
                <div className="text-[11px] text-text-muted mt-0.5 font-mono flex items-center gap-2">
                  <span>{(indexedDoc.size / 1024).toFixed(1)} KB</span>
                  {indexedDoc.pageCount && (
                    <>
                      <span>•</span>
                      <span>{indexedDoc.pageCount} page(s)</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{totalChunks} chunks in index</span>
                </div>
              </div>
            </div>

            {lastTimings && (
              <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-3">
                <div title="Parse timing">
                  Parse: <span className="text-text-secondary">{lastTimings.parseDurationMs}ms</span>
                </div>
                <div title="Chunk timing">
                  Chunk: <span className="text-text-secondary">{lastTimings.chunkDurationMs}ms</span>
                </div>
                <div title="Embedding timing">
                  Embed: <span className="text-text-secondary">{lastTimings.embeddingDurationMs}ms</span>
                </div>
                <div title="Total ingestion timing">
                  Total: <strong className="text-text-primary">{lastTimings.totalDurationMs}ms</strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">
            No document uploaded yet. You can upload custom PDF/TXT/MD files above, or search the pre-indexed baseline collections below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
