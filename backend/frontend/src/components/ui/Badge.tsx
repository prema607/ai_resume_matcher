import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "signal" | "amber";
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        tone === "neutral" && "bg-ink/5 text-ink-700",
        tone === "signal" && "bg-signal-50 text-signal-700",
        tone === "amber" && "bg-amber-50 text-amber-600",
        className
      )}
    >
      {children}
    </span>
  );
}
