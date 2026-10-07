import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { PipelineExecutionStatus } from "@/lib/types/experiment";

export interface StatusIndicatorProps {
  status: PipelineExecutionStatus | "ready";
  label?: string;
  className?: string;
  showText?: boolean;
}

export function StatusIndicator({
  status,
  label,
  className,
  showText = true,
}: StatusIndicatorProps) {
  const statusConfig = {
    idle: {
      color: "bg-status-idle",
      ring: "ring-slate-500/20",
      defaultLabel: "Not run yet",
    },
    ready: {
      color: "bg-blue-400",
      ring: "ring-blue-400/20",
      defaultLabel: "Ready",
    },
    running: {
      color: "bg-status-running animate-pulse",
      ring: "ring-sky-400/30",
      defaultLabel: "Executing...",
    },
    completed: {
      color: "bg-status-success",
      ring: "ring-emerald-500/20",
      defaultLabel: "Completed",
    },
    failed: {
      color: "bg-status-error",
      ring: "ring-rose-500/20",
      defaultLabel: "Failed",
    },
  };

  const current = statusConfig[status] || statusConfig.idle;
  const displayText = label || current.defaultLabel;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full ring-2",
          current.color,
          current.ring
        )}
      />
      {showText && (
        <span className="text-xs font-mono text-text-secondary select-none">
          {displayText}
        </span>
      )}
    </div>
  );
}
