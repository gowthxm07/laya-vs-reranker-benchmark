import { NextRequest, NextResponse } from "next/server";
import { SecurityBenchmarkRunnerService } from "@/server/services/security-benchmark-runner";

export const dynamic = "force-dynamic";

/**
 * GET /api/security-benchmark/history
 * Returns list of past security benchmark runs, or a single run's full details.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");
    const filename = searchParams.get("filename");

    if (runId || filename) {
      const target = runId || filename || "";
      const runResult = SecurityBenchmarkRunnerService.getHistoricalRun(target);
      if (!runResult) {
        return NextResponse.json(
          { success: false, error: `Security benchmark run "${target}" not found.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, result: runResult });
    }

    const runs = SecurityBenchmarkRunnerService.listHistoricalRuns();
    return NextResponse.json({ success: true, runs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load security benchmark history.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
