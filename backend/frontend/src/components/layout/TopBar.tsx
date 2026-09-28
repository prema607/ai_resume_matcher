
import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { health } from "@/lib/api";
import { cx } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

type ConnState = "checking" | "connected" | "unreachable";

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  const [state, setState] = useState<ConnState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await health.check();

        if (!cancelled) {
          setState(
            res.mongodb === "connected" ? "connected" : "unreachable"
          );
        }
      } catch {
        if (!cancelled) {
          setState("unreachable");
        }
      }
    }

    poll();

    const interval = window.setInterval(poll, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const connectionConfig = {
    checking: {
      label: "Checking",
      icon: Loader2,
      className: "text-ink-400",
      dotClassName: "bg-ink-300 animate-pulse",
    },
    connected: {
      label: "Online",
      icon: CheckCircle2,
      className: "text-emerald-600",
      dotClassName: "bg-emerald-500",
    },
    unreachable: {
      label: "Offline",
      icon: CircleAlert,
      className: "text-red-600",
      dotClassName: "bg-red-500",
    },
  }[state];

  const ConnectionIcon = connectionConfig.icon;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="flex min-h-[76px] items-center justify-between gap-4 px-5 py-4 md:px-8">
        {/* Page heading */}
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight text-ink md:text-2xl">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-1 line-clamp-1 text-xs text-ink-500 sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Connection status */}
          <div
            className={cx(
              "flex items-center gap-2 rounded-full border bg-surface px-2.5 py-1.5 sm:px-3",
              state === "connected" && "border-emerald-200",
              state === "unreachable" && "border-red-200",
              state === "checking" && "border-line"
            )}
            title={
              state === "connected"
                ? "Backend and database are connected"
                : state === "unreachable"
                  ? "Backend or database is unreachable"
                  : "Checking backend and database connection"
            }
          >
            <span
              className={cx(
                "h-1.5 w-1.5 rounded-full",
                connectionConfig.dotClassName
              )}
            />

            <ConnectionIcon
              className={cx(
                "hidden h-3.5 w-3.5 sm:block",
                connectionConfig.className,
                state === "checking" && "animate-spin"
              )}
            />

            <span
              className={cx(
                "font-mono text-[10px] font-medium uppercase tracking-wide sm:text-[11px]",
                connectionConfig.className
              )}
            >
              {connectionConfig.label}
            </span>
          </div>

          {actions}
        </div>
      </div>
    </header>
  );
}

