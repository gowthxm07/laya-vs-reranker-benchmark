import * as React from "react";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  pathAValue?: string;
  pathBValue?: string;
  deltaText?: string;
  isDeltaPositiveForLaya?: boolean;
}

export function MetricCard({
  title,
  description,
  icon: Icon,
  pathAValue = "—",
  pathBValue = "—",
  deltaText,
  isDeltaPositiveForLaya,
}: MetricCardProps) {
  const isExecuted = pathAValue !== "—" || pathBValue !== "—";

  return (
    <Card className="p-3.5 bg-surface border border-border flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
          <span className="font-medium text-text-secondary flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-accent" />
            {title}
          </span>
          {!isExecuted && (
            <span className="text-[10px] font-mono text-text-muted">
              Not run
            </span>
          )}
        </div>
        <p className="text-[11px] text-text-muted line-clamp-1 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
        {/* Path A */}
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted font-mono uppercase">
            Adv RAG
          </span>
          <span className="font-mono text-xs font-semibold text-text-primary mt-0.5">
            {pathAValue}
          </span>
        </div>

        {/* Path B */}
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted font-mono uppercase">
            Laya RAG
          </span>
          <span className="font-mono text-xs font-semibold text-text-primary mt-0.5">
            {pathBValue}
          </span>
        </div>
      </div>

      {deltaText && (
        <div className="mt-2 pt-1.5 border-t border-border/30 text-[10px] font-mono flex items-center justify-between">
          <span className="text-text-muted">Comparison:</span>
          <span
            className={
              isDeltaPositiveForLaya
                ? "text-emerald-400"
                : "text-text-secondary"
            }
          >
            {deltaText}
          </span>
        </div>
      )}
    </Card>
  );
}
