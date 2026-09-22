import { useEffect, useState, type ReactNode } from "react";
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
        if (!cancelled) setState(res.mongodb === "connected" ? "connected" : "unreachable");
      } catch {
        if (!cancelled) setState("unreachable");
      }
    }

    poll();
    const interval = window.setInterval(poll, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-paper/90 px-5 py-5 backdrop-blur md:px-8">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div
          className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 sm:flex"
          title={
            state === "connected"
              ? "Backend and database reachable"
              : state === "unreachable"
              ? "Backend unreachable — check the API server"
              : "Checking connection…"
          }
        >
          <span
            className={cx(
              "h-1.5 w-1.5 rounded-full",
              state === "connected" && "bg-emerald-500",
              state === "unreachable" && "bg-red-500",
              state === "checking" && "animate-pulse bg-ink-300"
            )}
          />
          <span className="font-mono text-[11px] text-ink-500">
            {state === "connected" ? "online" : state === "unreachable" ? "offline" : "checking"}
          </span>
        </div>
        {actions}
      </div>
    </header>
  );
}
