import { NextRequest, NextResponse } from "next/server";
import { BenchmarkDatasetService } from "@/server/services/benchmark-dataset-service";
import { BenchmarkRunnerService } from "@/server/services/benchmark-runner-service";
import { ComparisonMode } from "@/lib/types/comparison";
import { BenchmarkCategory } from "@/lib/types/benchmark";

export const dynamic = "force-dynamic";

/**
 * GET /api/benchmark
 * Returns dataset summary, categories, and benchmark case metadata.
 */
export async function GET() {
  try {
    const summary = BenchmarkDatasetService.getSummary();
    const cases = BenchmarkDatasetService.loadDataset();
    const caseSummaries = cases.map((c) => ({
      id: c.id,
      category: c.category,
      query: c.query,
      description: c.description,
      candidateCount: c.candidateChunks.length,
      relevantCount: c.relevantChunkIds.length,
      answerable: c.answerable,
    }));

    return NextResponse.json({
      success: true,
      summary,
      cases: caseSummaries,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to load benchmark dataset.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/benchmark
 * Executes the controlled benchmark suite across specified or all cases.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode: ComparisonMode = body.mode || "native";
    const contextBudget: number = Number(body.contextBudget) || 3;
    const runsPerQuery: number = Number(body.runsPerQuery) || 1;
    const category: BenchmarkCategory | undefined = body.category || undefined;
    const caseIds: string[] | undefined = Array.isArray(body.caseIds)
      ? body.caseIds
      : undefined;

    const runner = new BenchmarkRunnerService();
    const result = await runner.runBenchmark({
      mode,
      contextBudget,
      runsPerQuery,
      category,
      caseIds,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to execute benchmark suite.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
