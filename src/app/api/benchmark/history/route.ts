import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { BenchmarkSuiteResult } from "@/lib/types/benchmark";

interface RunSummaryItem {
  filename: string;
  runId: string;
  timestamp: number;
  gitCommit: string;
  mode: string;
  caseCount: number;
  completedCount: number;
  durationMs: number;
  llmModel: string;
  ceMeanF1: number;
  layaMeanF1: number;
  ceContextReduction: number;
  layaContextReduction: number;
  ceTotalLatency: number;
  layaTotalLatency: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedFilename = searchParams.get("filename");
    const requestedRunId = searchParams.get("runId");

    const resultsDir = path.join(process.cwd(), "data", "benchmark", "results");

    if (!fs.existsSync(resultsDir)) {
      return NextResponse.json({
        success: true,
        runs: [],
      });
    }

    const files = fs
      .readdirSync(resultsDir)
      .filter((f) => f.startsWith("benchmark-run-") && f.endsWith(".json"));

    // If specific file or runId requested, load and return full result
    if (requestedFilename || requestedRunId) {
      let targetFile = requestedFilename;

      if (!targetFile && requestedRunId) {
        // Search through files for matching runId
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(resultsDir, file), "utf-8");
            const parsed = JSON.parse(content) as BenchmarkSuiteResult;
            if (parsed.runId === requestedRunId) {
              targetFile = file;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      if (!targetFile) {
        return NextResponse.json(
          { success: false, error: "Requested benchmark run not found." },
          { status: 404 }
        );
      }

      // Security check: ensure targetFile is just a filename, no path traversal
      const safeFilename = path.basename(targetFile);
      const filePath = path.join(resultsDir, safeFilename);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { success: false, error: "File not found." },
          { status: 404 }
        );
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const result = JSON.parse(content) as BenchmarkSuiteResult;

      return NextResponse.json({
        success: true,
        result,
        filename: safeFilename,
      });
    }

    // Otherwise, list all runs with concise metadata
    const runSummaries: RunSummaryItem[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(resultsDir, file);
        const stats = fs.statSync(filePath);
        const rawContent = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(rawContent) as BenchmarkSuiteResult;

        runSummaries.push({
          filename: file,
          runId: parsed.runId || file.replace(".json", ""),
          timestamp: parsed.metadata?.timestamp || stats.mtimeMs,
          gitCommit: parsed.metadata?.gitCommit || "unknown",
          mode: parsed.metadata?.mode || "native",
          caseCount: parsed.caseCount || parsed.queryResults?.length || 0,
          completedCount: parsed.completedCount || parsed.queryResults?.length || 0,
          durationMs: parsed.durationMs || 0,
          llmModel: parsed.metadata?.llmModel || "unknown",
          ceMeanF1: parsed.crossEncoderAggregates?.f1?.mean ?? 0,
          layaMeanF1: parsed.layaAggregates?.f1?.mean ?? 0,
          ceContextReduction: parsed.crossEncoderAggregates?.contextReductionPercent?.mean ?? 0,
          layaContextReduction: parsed.layaAggregates?.contextReductionPercent?.mean ?? 0,
          ceTotalLatency: parsed.crossEncoderAggregates?.totalLatencyMs?.mean ?? 0,
          layaTotalLatency: parsed.layaAggregates?.totalLatencyMs?.mean ?? 0,
        });
      } catch {
        // Skip unparseable files
        continue;
      }
    }

    // Sort newest first
    runSummaries.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      success: true,
      runs: runSummaries,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load benchmark history.";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
