import { Link } from "react-router-dom";
import { Trash2, Radar } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { JobDescriptionResponse } from "@/lib/types";

interface JobCardProps {
  job: JobDescriptionResponse;
  onDelete: (id: string) => void;
}

export function JobCard({ job, onDelete }: JobCardProps) {
  const visibleSkills = job.required_skills.slice(0, 5);
  const extraSkillCount = job.required_skills.length - visibleSkills.length;

  return (
    <div className="card group relative flex flex-col gap-3 p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/jobs/${job.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-display text-sm font-semibold text-ink">{job.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-ink-500">{job.description}</p>
        </Link>
        <button
          onClick={() => onDelete(job.id)}
          className="shrink-0 rounded-md p-1.5 text-ink-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label={`Delete ${job.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {job.required_skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => (
            <Badge key={skill} tone="amber">
              {skill}
            </Badge>
          ))}
          {extraSkillCount > 0 && <Badge>+{extraSkillCount} more</Badge>}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line-subtle pt-3">
        <span className="font-mono text-[11px] text-ink-300">Posted {formatDate(job.created_at)}</span>
        <Link
          to={`/search?job_id=${job.id}`}
          className="flex items-center gap-1 text-xs font-medium text-signal hover:text-signal-600"
        >
          <Radar className="h-3 w-3" /> Find matches
        </Link>
      </div>
    </div>
  );
}
