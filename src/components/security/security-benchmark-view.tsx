"use client";

import * as React from "react";
import {
  SecurityBenchmarkRunResult,
  SecurityRunSummaryItem,
} from "@/lib/types/security-benchmark";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Play,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Eye,
  X,
  FileCheck,
  RefreshCw,
  Search,
} from "lucide-react";

export function SecurityBenchmarkView() {
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const [progressInfo, setProgressInfo] = React.useState<{
    completed: number;
    total: number;
    currentCaseId: string;
  }>({ completed: 0, total: 0, currentCaseId: "" });

  const [activeResult, setActiveResult] =
    React.useState<SecurityBenchmarkRunResult | null>(null);
  const [historyRuns, setHistoryRuns] = React.useState<SecurityRunSummaryItem[]>([]);
  const [selectedHistoryFile, setSelectedHistoryFile] = React.useState<string>("");
  const [isLoadingHistory, setIsLoadingHistory] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filter state for results table
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Case Detail Modal state
  const [inspectCase, setInspectCase] = React.useState<{
    caseItem: SecurityBenchmarkRunResult["caseResults"][0]["caseItem"];
    pathA: SecurityBenchmarkRunResult["caseResults"][0]["pathA"];
    pathB: SecurityBenchmarkRunResult["caseResults"][0]["pathB"];
  } | null>(null);

  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Fetch run history on mount
  const fetchHistory = React.useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/security-benchmark/history");
      const data = await res.json();
      if (data.success && Array.isArray(data.runs)) {
        setHistoryRuns(data.runs);
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHistory();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchHistory]);

  // Load a historical run
  const handleLoadHistoricalRun = async (filename: string) => {
    if (!filename) return;
    setSelectedHistoryFile(filename);
    setError(null);
    try {
      const res = await fetch(`/api/security-benchmark/history?filename=${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load historical benchmark run.");
      }
      setActiveResult(data.result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Run benchmark (smoke test or full)
  const handleRunBenchmark = async (isSmokeTest: boolean) => {
    if (isRunning) return;

    setIsRunning(true);
    setError(null);
    setElapsedSeconds(0);
    const totalCases = isSmokeTest ? 6 : 34;
    setProgressInfo({ completed: 0, total: totalCases, currentCaseId: "Initializing..." });

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const res = await fetch("/api/security-benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSmokeTest }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Security benchmark execution failed.");
      }

      setActiveResult(data.result);
      fetchHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Filtered case results
  const filteredCases = React.useMemo(() => {
    if (!activeResult) return [];
    return activeResult.caseResults.filter((item) => {
      const matchCat =
        categoryFilter === "ALL" || item.caseItem.category === categoryFilter;
      const matchSearch =
        !searchQuery.trim() ||
        item.caseItem.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.caseItem.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.caseItem.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeResult, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Benchmark Control Panel */}
      <section className="border border-border rounded-xl bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Reproducible Security Benchmark Suite
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRunBenchmark(true)}
              disabled={isRunning}
              isLoading={isRunning && progressInfo.total === 6}
              className="text-xs h-8"
              title="Runs a 6-case representative subset covering diverse categories"
            >
              <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" />
              Run Smoke Test (6 Cases)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleRunBenchmark(false)}
              disabled={isRunning}
              isLoading={isRunning && progressInfo.total > 6}
              className="text-xs h-8"
              title="Runs the complete 34-case benchmark on demo_document_security.pdf"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Run Full Benchmark (34 Cases)
            </Button>
          </div>
        </div>

        {/* History Selector & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <span className="text-text-secondary font-medium">Historical Runs:</span>
            <select
              value={selectedHistoryFile}
              onChange={(e) => handleLoadHistoricalRun(e.target.value)}
              disabled={isRunning || historyRuns.length === 0}
              className="h-8 rounded-md border border-border bg-white px-2.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">
                {historyRuns.length === 0
                  ? "No previous runs saved"
                  : "-- Load a previous benchmark run --"}
              </option>
              {historyRuns.map((run) => (
                <option key={run.filename} value={run.filename}>
                  {new Date(run.timestamp).toLocaleString()} ({run.isSmokeTest ? "Smoke" : "Full"}, {run.caseCount} cases)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface"
              title="Refresh history list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-text-muted">
            <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Target Corpus: <strong>demo_document_security.pdf</strong></span>
          </div>
        </div>

        {/* Live Execution Progress */}
        {isRunning && (
          <div className="p-4 rounded-lg border border-accent/30 bg-accent/5 space-y-2 text-xs animate-in fade-in">
            <div className="flex items-center justify-between text-text-primary font-medium">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
                <span>
                  Executing security benchmark ({progressInfo.total} test cases sequential evaluation)...
                </span>
              </span>
              <span className="font-mono text-accent">{elapsedSeconds}s elapsed</span>
            </div>
            <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
              <div className="bg-accent h-2 rounded-full animate-pulse w-2/3" />
            </div>
            <div className="text-[11px] text-text-muted flex justify-between font-mono">
              <span>Evaluating live vector retrieval & LLM generation...</span>
              <span>Controlled sequential execution</span>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* BENCHMARK RESULTS REPORT */}
      {activeResult && !isRunning && (
        <section className="space-y-6 animate-in fade-in duration-200">
          {/* Metadata Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 bg-white p-4 rounded-xl border border-border shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text-primary">
                  Security Benchmark Results Report
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border font-medium">
                  {activeResult.isSmokeTest ? "Smoke Test (6 Cases)" : "Full Suite (34 Cases)"}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Run ID: <code className="font-mono">{activeResult.runId}</code> · Executed:{" "}
                {new Date(activeResult.timestamp).toLocaleString()} · Duration:{" "}
                <strong>{(activeResult.durationMs / 1000).toFixed(1)}s</strong>
              </p>
            </div>
            <div className="text-right text-xs text-text-muted font-mono">
              <div>Completed: {activeResult.completedCount} / {activeResult.caseCount}</div>
              {activeResult.errorCount > 0 && (
                <div className="text-rose-600 font-semibold">Errors: {activeResult.errorCount}</div>
              )}
            </div>
          </div>

          {/* Comparative KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Canary Disclosure Rate"
              subtitle="Synthetic key leak in answer"
              pathA={activeResult.pathAMetrics.canaryDisclosureRate.formatted}
              pathB={activeResult.pathBMetrics.canaryDisclosureRate.formatted}
              lowerIsBetter
            />
            <KpiCard
              title="Unauthorized Disclosure"
              subtitle="Prohibited sensitive facts in answer"
              pathA={activeResult.pathAMetrics.unauthorizedSensitiveDisclosureRate.formatted}
              pathB={activeResult.pathBMetrics.unauthorizedSensitiveDisclosureRate.formatted}
              lowerIsBetter
            />
            <KpiCard
              title="Context Exposure"
              subtitle="Unauthorized passages sent to LLM"
              pathA={activeResult.pathAMetrics.unauthorizedContextExposureRate.formatted}
              pathB={activeResult.pathBMetrics.unauthorizedContextExposureRate.formatted}
              lowerIsBetter
            />
            <KpiCard
              title="Appropriate Refusal"
              subtitle="Prohibited queries safely refused"
              pathA={activeResult.pathAMetrics.appropriateRefusalRate.formatted}
              pathB={activeResult.pathBMetrics.appropriateRefusalRate.formatted}
              lowerIsBetter={false}
            />
          </div>

          {/* Comprehensive Metrics Comparison Table */}
          <div className="border border-border rounded-xl bg-white overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-border bg-surface-subtle">
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                Comparative Security & Utility Evaluation Metrics
              </h4>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/40 text-text-muted text-[11px]">
                  <th className="py-2.5 px-4 font-normal">Metric Name</th>
                  <th className="py-2.5 px-4 font-normal">Evaluation Scope</th>
                  <th className="py-2.5 px-4 font-medium text-text-primary">Path A (Cross-Encoder + RBAC)</th>
                  <th className="py-2.5 px-4 font-medium text-text-primary">Path B (Laya Instructions Only)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {/* Security Metrics Header */}
                <tr className="bg-surface/50 text-text-muted font-sans text-[10px] font-semibold uppercase tracking-wider">
                  <td colSpan={4} className="py-1.5 px-4">Security Defense Metrics (Lower is better)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Canary Disclosure Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">Canary Extraction & Injection Queries</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathAMetrics.canaryDisclosureRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathBMetrics.canaryDisclosureRate.formatted}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Unauthorized Sensitive Disclosure Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">All Prohibited Access Queries</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathAMetrics.unauthorizedSensitiveDisclosureRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathBMetrics.unauthorizedSensitiveDisclosureRate.formatted}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Unauthorized Context Exposure Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">Prohibited Queries Sent to LLM Context</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathAMetrics.unauthorizedContextExposureRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathBMetrics.unauthorizedContextExposureRate.formatted}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Prompt-Injection Success Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">Adversarial Instruction Attacks</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathAMetrics.promptInjectionSuccessRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathBMetrics.promptInjectionSuccessRate.formatted}</td>
                </tr>

                {/* Utility Metrics Header */}
                <tr className="bg-surface/50 text-text-muted font-sans text-[10px] font-semibold uppercase tracking-wider">
                  <td colSpan={4} className="py-1.5 px-4">Utility & Answer Preservation Metrics (Higher is better)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Benign Answer Success Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">Benign Public & Mixed-Context Queries</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathAMetrics.benignAnswerSuccessRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathBMetrics.benignAnswerSuccessRate.formatted}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Appropriate Refusal Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">Prohibited Requests Properly Blocked</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathAMetrics.appropriateRefusalRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathBMetrics.appropriateRefusalRate.formatted}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Authorized Answer Success Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">Permitted Access for Authorized Roles</td>
                  <td className="py-2.5 px-4 font-semibold text-emerald-700">{activeResult.pathAMetrics.authorizedAnswerSuccessRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathBMetrics.authorizedAnswerSuccessRate.formatted}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-sans font-medium text-text-primary">Relevant Public Information Loss Rate</td>
                  <td className="py-2.5 px-4 font-sans text-text-muted text-[10px]">Benign Information Dropped (Lower is better)</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathAMetrics.relevantPublicInformationLossRate.formatted}</td>
                  <td className="py-2.5 px-4 font-semibold text-text-primary">{activeResult.pathBMetrics.relevantPublicInformationLossRate.formatted}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Test Case Results Table */}
          <div className="border border-border rounded-xl bg-white overflow-hidden shadow-xs space-y-0">
            <div className="p-4 border-b border-border bg-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                  Test Case Results & Findings ({filteredCases.length} / {activeResult.caseResults.length})
                </h4>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Inspect comparative answer outputs, retrieved context passages, and evaluator findings.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-text-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search queries..."
                    className="h-8 pl-8 pr-2.5 text-xs rounded-md border border-border bg-white text-text-primary focus:outline-none focus:border-accent w-40 sm:w-48"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 px-2 text-xs rounded-md border border-border bg-white text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="ALL">All Categories</option>
                  <option value="BENIGN_PUBLIC">Benign Public</option>
                  <option value="UNAUTHORIZED_CONFIDENTIAL">Unauthorized Confidential</option>
                  <option value="UNAUTHORIZED_RESTRICTED">Unauthorized Restricted</option>
                  <option value="CANARY_EXTRACTION">Canary Extraction</option>
                  <option value="PROMPT_INJECTION">Prompt Injection</option>
                  <option value="MIXED_CONTEXT">Mixed Context</option>
                  <option value="RELEVANT_SENSITIVE">Relevant Sensitive</option>
                  <option value="AUTHORIZED_ACCESS">Authorized Access</option>
                  <option value="AMBIGUOUS_METADATA">Ambiguous Metadata</option>
                  <option value="INDIRECT_PARAPHRASING">Indirect Paraphrasing</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/40 text-text-muted text-[11px]">
                    <th className="py-2.5 px-3 font-normal">Case ID</th>
                    <th className="py-2.5 px-3 font-normal">Category</th>
                    <th className="py-2.5 px-3 font-normal">Role</th>
                    <th className="py-2.5 px-3 font-normal">Query</th>
                    <th className="py-2.5 px-3 font-medium text-text-primary">Path A Outcome</th>
                    <th className="py-2.5 px-3 font-medium text-text-primary">Path B Outcome</th>
                    <th className="py-2.5 px-3 text-right font-normal">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-[11px]">
                  {filteredCases.map((row) => {
                    const { caseItem, pathA, pathB } = row;
                    return (
                      <tr key={caseItem.id} className="hover:bg-surface-subtle/50 transition-colors">
                        <td className="py-2 px-3 font-mono font-semibold text-text-primary">
                          {caseItem.id}
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border">
                            {caseItem.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px] text-text-secondary">
                          {caseItem.simulatedRole}
                        </td>
                        <td className="py-2 px-3 text-text-secondary max-w-xs truncate" title={caseItem.query}>
                          {caseItem.query}
                        </td>
                        <td className="py-2 px-3">
                          <OutcomeBadge
                            isPermitted={caseItem.isPermitted}
                            evaluation={pathA.evaluation}
                            status={pathA.status}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <OutcomeBadge
                            isPermitted={caseItem.isPermitted}
                            evaluation={pathB.evaluation}
                            status={pathB.status}
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectCase(row)}
                            className="h-7 px-2 text-[11px]"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* CASE INSPECTION MODAL */}
      {inspectCase && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-accent">
                    {inspectCase.caseItem.id}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border">
                    {inspectCase.caseItem.category}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                    inspectCase.caseItem.isPermitted
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {inspectCase.caseItem.isPermitted ? "PERMITTED" : "PROHIBITED"}
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-text-primary mt-1">
                  &ldquo;{inspectCase.caseItem.query}&rdquo;
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectCase(null)}
                className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="p-3 bg-surface-subtle border border-border rounded-lg text-text-secondary">
                <span className="font-semibold text-text-primary">Ground Truth Specification: </span>
                {inspectCase.caseItem.explanation}
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Path A Inspect */}
                <div className="border border-border rounded-lg p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between border-b border-border pb-1.5 font-semibold text-[11px] text-text-primary">
                    <span>Path A: Cross-Encoder + Conventional Guardrails</span>
                    <OutcomeBadge
                      isPermitted={inspectCase.caseItem.isPermitted}
                      evaluation={inspectCase.pathA.evaluation}
                      status={inspectCase.pathA.status}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-mono">Generated Answer:</span>
                    <pre className="mt-1 p-2.5 bg-surface-subtle border border-border rounded text-[11px] font-sans whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {inspectCase.pathA.generatedAnswer}
                    </pre>
                  </div>
                  <div className="text-[10px] font-mono space-y-0.5 text-text-muted">
                    <div>Included in Context: {inspectCase.pathA.includedChunkIds.length} passages</div>
                    <div>Blocked by Authorization: {inspectCase.pathA.blockedChunkIds.length} passages</div>
                    <div>Evaluator Rationale: <span className="text-text-secondary font-sans">{inspectCase.pathA.evaluation.evaluationRationale}</span></div>
                  </div>
                </div>

                {/* Path B Inspect */}
                <div className="border border-border rounded-lg p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between border-b border-border pb-1.5 font-semibold text-[11px] text-text-primary">
                    <span>Path B: Laya RAG + Security Instructions Only</span>
                    <OutcomeBadge
                      isPermitted={inspectCase.caseItem.isPermitted}
                      evaluation={inspectCase.pathB.evaluation}
                      status={inspectCase.pathB.status}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-mono">Generated Answer:</span>
                    <pre className="mt-1 p-2.5 bg-surface-subtle border border-border rounded text-[11px] font-sans whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {inspectCase.pathB.generatedAnswer}
                    </pre>
                  </div>
                  <div className="text-[10px] font-mono space-y-0.5 text-text-muted">
                    <div>Included in Context: {inspectCase.pathB.includedChunkIds.length} passages</div>
                    <div>Blocked by Authorization: 0 (No application RBAC)</div>
                    <div>Evaluator Rationale: <span className="text-text-secondary font-sans">{inspectCase.pathB.evaluation.evaluationRationale}</span></div>
                  </div>
                </div>
              </div>

              {/* Raw Prompt Context */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary">Path A Raw Context Text:</span>
                <pre className="p-3 bg-surface-subtle border border-border rounded text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {inspectCase.pathA.rawContextText || "[No context passages authorized]"}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-text-secondary">Path B Raw Context Text:</span>
                <pre className="p-3 bg-surface-subtle border border-border rounded text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {inspectCase.pathB.rawContextText || "[No context passages retained]"}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-border flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectCase(null)}
                className="text-xs"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Outcome Badge Component
 */
function OutcomeBadge({
  isPermitted,
  evaluation,
  status,
}: {
  isPermitted: boolean;
  evaluation: SecurityBenchmarkRunResult["caseResults"][0]["pathA"]["evaluation"];
  status: "completed" | "error";
}) {
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-bold">
        Error
      </span>
    );
  }

  if (evaluation.isCanaryDisclosed) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200">
        <XCircle className="h-3 w-3 text-rose-600" />
        Canary Disclosed
      </span>
    );
  }

  if (evaluation.isSensitiveDisclosed) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200">
        <XCircle className="h-3 w-3 text-rose-600" />
        Sensitive Breach
      </span>
    );
  }

  if (!isPermitted && evaluation.isAppropriateRefusal) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Refused Safely
      </span>
    );
  }

  if (isPermitted && (evaluation.isBenignSuccess || evaluation.isAuthorizedSuccess)) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Answered Correctly
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
      Neutral / Incomplete
    </span>
  );
}

/**
 * KPI Metric Card
 */
function KpiCard({
  title,
  subtitle,
  pathA,
  pathB,
  lowerIsBetter: _lowerIsBetter,
}: {
  title: string;
  subtitle: string;
  pathA: string;
  pathB: string;
  lowerIsBetter: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4 bg-white space-y-2 shadow-xs">
      <div>
        <h4 className="text-xs font-bold text-text-primary tracking-tight">{title}</h4>
        <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>
      </div>
      <div className="pt-2 border-t border-border grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <div className="text-[10px] text-text-muted">Path A (CE + RBAC)</div>
          <div className="font-bold text-text-primary mt-0.5">{pathA}</div>
        </div>
        <div>
          <div className="text-[10px] text-text-muted">Path B (Laya Only)</div>
          <div className="font-bold text-text-primary mt-0.5">{pathB}</div>
        </div>
      </div>
    </div>
  );
}
