import * as fs from "fs";
import * as path from "path";
import { BenchmarkCase, BenchmarkCategory } from "@/lib/types/benchmark";

export class BenchmarkDatasetService {
  private static cachedCases: BenchmarkCase[] | null = null;
  private static datasetPath = path.resolve(
    process.cwd(),
    "data/benchmark/benchmark-dataset.json"
  );

  /**
   * Loads and validates the benchmark dataset.
   */
  public static loadDataset(forceReload: boolean = false): BenchmarkCase[] {
    if (this.cachedCases && !forceReload) {
      return this.cachedCases;
    }

    if (!fs.existsSync(this.datasetPath)) {
      throw new Error(`Benchmark dataset not found at: ${this.datasetPath}`);
    }

    const raw = fs.readFileSync(this.datasetPath, "utf-8");
    const parsed = JSON.parse(raw) as BenchmarkCase[];

    this.validateDataset(parsed);
    this.cachedCases = parsed;
    return parsed;
  }

  /**
   * Validates dataset integrity and schema invariants.
   */
  public static validateDataset(cases: BenchmarkCase[]): void {
    if (!Array.isArray(cases) || cases.length === 0) {
      throw new Error("Benchmark dataset must be a non-empty array of cases.");
    }

    const seenIds = new Set<string>();
    const validCategories: Set<BenchmarkCategory> = new Set([
      "NORMAL",
      "DISTRACTOR_HEAVY",
      "MULTI_CHUNK",
      "AMBIGUOUS",
      "PARTIAL_CONTEXT",
      "NO_ANSWER",
      "SINGLE_RELEVANT",
      "CONFLICTING_CONTEXT",
      "LONG_CONTEXT",
    ]);

    for (const c of cases) {
      if (!c.id || typeof c.id !== "string") {
        throw new Error(`Benchmark case has invalid or missing id.`);
      }
      if (seenIds.has(c.id)) {
        throw new Error(`Duplicate benchmark case id detected: ${c.id}`);
      }
      seenIds.add(c.id);

      if (!validCategories.has(c.category)) {
        throw new Error(`Case ${c.id} has invalid category: ${c.category}`);
      }
      if (!c.query || !c.query.trim()) {
        throw new Error(`Case ${c.id} has empty query.`);
      }
      if (!Array.isArray(c.candidateChunks) || c.candidateChunks.length === 0) {
        throw new Error(`Case ${c.id} must have non-empty candidateChunks.`);
      }
      if (!Array.isArray(c.relevantChunkIds)) {
        throw new Error(`Case ${c.id} has invalid relevantChunkIds array.`);
      }
      if (typeof c.answerable !== "boolean") {
        throw new Error(`Case ${c.id} answerable must be a boolean.`);
      }
      if (!c.referenceAnswer || !c.referenceAnswer.trim()) {
        throw new Error(`Case ${c.id} has empty referenceAnswer.`);
      }

      // Check that all relevantChunkIds exist in candidateChunks (unless answerable is false and it's empty)
      const chunkIdSet = new Set(c.candidateChunks.map((chunk) => chunk.id));
      for (const relId of c.relevantChunkIds) {
        if (!chunkIdSet.has(relId)) {
          throw new Error(
            `Case ${c.id}: relevantChunkId "${relId}" does not exist in candidateChunks.`
          );
        }
      }

      // If answerable is false, relevantChunkIds should typically be empty
      if (!c.answerable && c.relevantChunkIds.length > 0) {
        throw new Error(
          `Case ${c.id} is marked answerable=false but contains relevantChunkIds.`
        );
      }
    }
  }

  public static getCaseById(id: string): BenchmarkCase | undefined {
    const dataset = this.loadDataset();
    return dataset.find((c) => c.id === id);
  }

  public static getCasesByCategory(category: BenchmarkCategory): BenchmarkCase[] {
    const dataset = this.loadDataset();
    return dataset.filter((c) => c.category === category);
  }

  public static getCategories(): BenchmarkCategory[] {
    return [
      "NORMAL",
      "DISTRACTOR_HEAVY",
      "MULTI_CHUNK",
      "AMBIGUOUS",
      "PARTIAL_CONTEXT",
      "NO_ANSWER",
      "SINGLE_RELEVANT",
      "CONFLICTING_CONTEXT",
      "LONG_CONTEXT",
    ];
  }

  public static getSummary(): {
    totalCases: number;
    categories: Record<BenchmarkCategory, number>;
    answerableCount: number;
    unanswerableCount: number;
  } {
    const dataset = this.loadDataset();
    const categories: Record<BenchmarkCategory, number> = {
      NORMAL: 0,
      DISTRACTOR_HEAVY: 0,
      MULTI_CHUNK: 0,
      AMBIGUOUS: 0,
      PARTIAL_CONTEXT: 0,
      NO_ANSWER: 0,
      SINGLE_RELEVANT: 0,
      CONFLICTING_CONTEXT: 0,
      LONG_CONTEXT: 0,
    };

    let answerableCount = 0;
    let unanswerableCount = 0;

    for (const c of dataset) {
      categories[c.category] = (categories[c.category] || 0) + 1;
      if (c.answerable) {
        answerableCount++;
      } else {
        unanswerableCount++;
      }
    }

    return {
      totalCases: dataset.length,
      categories,
      answerableCount,
      unanswerableCount,
    };
  }
}
