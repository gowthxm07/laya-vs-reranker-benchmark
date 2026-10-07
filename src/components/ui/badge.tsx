import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "outline" | "success" | "warning" | "muted" | "danger";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center font-mono font-medium rounded-sm border transition-colors select-none";

  const variants = {
    default:
      "bg-surface-elevated text-text-secondary border-border",
    accent:
      "bg-accent-subtle text-blue-400 border-accent-border",
    outline:
      "bg-transparent text-text-secondary border-border",
    success:
      "bg-emerald-950/40 text-emerald-400 border-emerald-800/60",
    warning:
      "bg-amber-950/40 text-amber-400 border-amber-800/60",
    muted:
      "bg-canvas-subtle text-text-muted border-border/50",
    danger:
      "bg-red-950/40 text-red-400 border-red-800/60",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px] leading-none",
    md: "px-2 py-0.5 text-xs leading-none",
  };

  return (
    <span className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  );
}
