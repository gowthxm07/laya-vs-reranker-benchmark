import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      disabled,
      isLoading,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      primary:
        "bg-accent text-white hover:bg-accent-hover shadow-sm active:translate-y-[0.5px]",
      secondary:
        "bg-surface-elevated text-text-primary border border-border hover:bg-surface-subtle hover:border-border-strong",
      outline:
        "border border-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated",
      ghost:
        "text-text-secondary hover:text-text-primary hover:bg-surface-subtle",
      danger:
        "bg-status-error text-white hover:bg-red-600 focus-visible:ring-red-400",
    };

    const sizes = {
      sm: "h-7 px-2.5 text-xs rounded-sm gap-1.5",
      md: "h-8.5 px-3.5 text-xs rounded gap-2",
      lg: "h-10 px-4 text-sm rounded gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
