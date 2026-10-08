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
      "bg-accent-subtle text-accent border-accent-border",
    outline:
      "bg-transparent text-text-secondary border-border",
    success:
      "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning:
      "bg-amber-50 text-amber-800 border-amber-200",
    muted:
      "bg-surface-subtle text-text-muted border-border/70",
    danger:
      "bg-rose-50 text-rose-800 border-rose-200",
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
