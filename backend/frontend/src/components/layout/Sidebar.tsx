import { NavLink } from "react-router-dom";
import { LayoutGrid, Users, Briefcase, Radar } from "lucide-react";
import { cx } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/resumes", label: "Candidates", icon: Users, end: false },
  { to: "/jobs", label: "Roles", icon: Briefcase, end: false },
  { to: "/search", label: "Match", icon: Radar, end: false },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
          <Radar className="h-4 w-4" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold leading-none text-ink">Signal</p>
          <p className="mt-0.5 text-[11px] leading-none text-ink-500">resume matching</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-signal-50 text-signal-700"
                  : "text-ink-500 hover:bg-ink/[0.04] hover:text-ink"
              )
            }
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-lg border border-line-subtle bg-paper-100 px-3 py-3">
        <p className="text-[11px] font-medium text-ink-500">
          Candidates are parsed, embedded, and ranked by semantic similarity to each role.
        </p>
      </div>
    </aside>
  );
}
