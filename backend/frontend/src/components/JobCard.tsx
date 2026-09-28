
import { Link } from "react-router-dom";
import { ArrowUpRight, Radar, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { JobDescriptionResponse } from "@/lib/types";

interface JobCardProps {
  job: JobDescriptionResponse;
  onDelete: (id: string) => void;
}

export function JobCard({ job, onDelete }: JobCardProps) {
  const visibleSkills = job.required_skills.slice(0, 4);
  const extraSkillCount =
    job.required_skills.length - visibleSkills.length;

  return (
    <div className="card group relative flex h-full flex-col overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/jobs/${job.id}`}
          className="min-w-0 flex-1"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-signal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-signal">
              Open role
            </span>
          </div>

          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-ink transition-colors group-hover:text-signal">
            {job.title}
          </h3>

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-500">
            {job.description}
          </p>
        </Link>

        <button
          onClick={() => onDelete(job.id)}
          className="shrink-0 rounded-lg p-2 text-ink-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label={`Delete ${job.title}`}
          title="Delete role"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Skills */}
      <div className="mt-4 min-h-[28px]">
        {job.required_skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <Badge key={skill} tone="amber">
                {skill}
              </Badge>
            ))}

            {extraSkillCount > 0 && (
              <Badge>+{extraSkillCount} more</Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-300">
            No specific skills listed
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-300">
            Posted
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-500">
            {formatDate(job.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Link
            to={`/jobs/${job.id}`}
            className="rounded-md p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink"
            aria-label={`View ${job.title}`}
            title="View role"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <Link
            to={`/search?job_id=${job.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-signal px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-signal-600 hover:shadow-sm"
          >
            <Radar className="h-3.5 w-3.5" />
            Find matches
          </Link>
        </div>
      </div>
    </div>
  );
}

