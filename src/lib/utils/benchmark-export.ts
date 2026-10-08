import { BenchmarkSuiteResult } from "@/lib/types/benchmark";

/**
 * Converts a BenchmarkSuiteResult to a standard CSV string for spreadsheet analysis.
 */
export function generateBenchmarkCsv(result: BenchmarkSuiteResult): string {
  const headers = [
    "QueryID",
    "Category",
    "Query",
    "Answerable",
    "GroundTruthCount",
    "CESelectedCount",
    "LayaSelectedCount",
    "CE_Precision",
    "Laya_Precision",
    "CE_Recall",
    "Laya_Recall",
    "CE_F1",
    "Laya_F1",
    "CE_ContextReductionPct",
    "Laya_ContextReductionPct",
    "CE_RelLatencyMs",
    "Laya_RelLatencyMs",
    "CE_TotalLatencyMs",
    "Laya_TotalLatencyMs",
    "CE_PromptTokens",
    "CE_CompletionTokens",
    "CE_TotalTokens",
    "Laya_PromptTokens",
    "Laya_CompletionTokens",
    "Laya_TotalTokens",
    "CE_FactCoverage",
    "Laya_FactCoverage",
    "CE_LexicalGroundedness",
    "Laya_LexicalGroundedness",
    "OutcomeClassification",
    "Notes",
  ];

  const rows = result.queryResults.map((q) => {
    const ce = q.crossEncoder;
    const laya = q.laya;
    const gt = q.groundTruth;

    const values = [
      q.queryId,
      q.category,
      `"${q.query.replace(/"/g, '""')}"`,
      q.answerable ? "true" : "false",
      gt.relevantChunkIds.length,
      ce.selectedChunkIds.length,
      laya.selectedChunkIds.length,
      ce.relevanceMetrics.precision.toFixed(4),
      laya.relevanceMetrics.precision.toFixed(4),
      ce.relevanceMetrics.recall.toFixed(4),
      laya.relevanceMetrics.recall.toFixed(4),
      ce.relevanceMetrics.f1.toFixed(4),
      laya.relevanceMetrics.f1.toFixed(4),
      ce.contextMetrics.contextReductionPercent.toFixed(1),
      laya.contextMetrics.contextReductionPercent.toFixed(1),
      ce.latencies.relevanceMs,
      laya.latencies.relevanceMs,
      ce.latencies.totalMs,
      laya.latencies.totalMs,
      ce.tokens.prompt,
      ce.tokens.completion,
      ce.tokens.total,
      laya.tokens.prompt,
      laya.tokens.completion,
      laya.tokens.total,
      ce.answerMetrics.factCoverage.toFixed(4),
      laya.answerMetrics.factCoverage.toFixed(4),
      (ce.answerMetrics.lexicalGroundednessScore ?? ce.answerMetrics.faithfulnessScore).toFixed(4),
      (laya.answerMetrics.lexicalGroundednessScore ?? laya.answerMetrics.faithfulnessScore).toFixed(4),
      q.failureAnalysis.classification,
      `"${q.failureAnalysis.notes.replace(/"/g, '""')}"`,
    ];

    return values.join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Triggers a browser download of a file with given content, filename, and mime type.
 */
export function downloadFile(
  content: string,
  filename: string,
  contentType: string
): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
