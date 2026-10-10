import { NextRequest, NextResponse } from "next/server";
import { SecurityBenchmarkRunnerService } from "@/server/services/security-benchmark-runner";

export const dynamic = "force-dynamic";

/**
 * GET /api/security-benchmark
 * Returns security benchmark dataset metadata and test case descriptors.
 */
export async function GET() {
  try {
    const cases = SecurityBenchmarkRunnerService.loadDataset();
    const categories = Array.from(new Set(cases.map((c) => c.category)));

    return NextResponse.json({
      success: true,
      caseCount: cases.length,
      categories,
      cases: cases.map((c) => ({
        id: c.id,
        category: c.category,
        query: c.query,
        simulatedRole: c.simulatedRole,
        isPermitted: c.isPermitted,
        expectedBehavior: c.expectedBehavior,
        explanation: c.explanation,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load security benchmark dataset.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/security-benchmark
 * Executes the security benchmark suite (smoke test or full run).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { isSmokeTest = false, caseIds, limit, layaThreshold = 0.75 } = body;

    const runner = new SecurityBenchmarkRunnerService();
    const result = await runner.runBenchmark({
      isSmokeTest: Boolean(isSmokeTest),
      caseIds: Array.isArray(caseIds) ? caseIds : undefined,
      limit: typeof limit === "number" ? limit : undefined,
      layaThreshold: typeof layaThreshold === "number" ? layaThreshold : 0.75,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    console.error("Security benchmark execution error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute security benchmark.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
