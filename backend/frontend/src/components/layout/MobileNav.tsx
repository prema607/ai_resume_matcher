import { NavLink } from "react-router-dom";
import { LayoutGrid, Users, Briefcase, Radar } from "lucide-react";
import { cx } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/resumes", label: "Candidates", icon: Users, end: false },
  { to: "/jobs", label: "Roles", icon: Briefcase, end: false },
  { to: "/search", label: "Match", icon: Radar, end: false },
];

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cx(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              isActive ? "text-signal" : "text-ink-500"
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
