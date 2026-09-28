
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  FileText,
  Mail,
  Phone,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate, initials } from "@/lib/utils";
import type { ResumeListItem } from "@/lib/types";

interface ResumeCardProps {
  resume: ResumeListItem;
  onDelete: (id: string) => void;
}

export function ResumeCard({ resume, onDelete }: ResumeCardProps) {
  const visibleSkills = resume.skills.slice(0, 4);
  const extraSkillCount = resume.skills.length - visibleSkills.length;

  return (
    <div className="card group relative flex h-full flex-col overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      {/* Candidate header */}
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/resumes/${resume.id}`}
          className="flex min-w-0 flex-1 items-start gap-3"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs font-semibold text-white">
            {initials(resume.candidate_name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-md bg-signal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-signal">
                Candidate
              </span>
            </div>

            <h3 className="truncate font-display text-base font-semibold text-ink transition-colors group-hover:text-signal">
              {resume.candidate_name}
            </h3>

            <div className="mt-2 space-y-1 text-xs text-ink-500">
              {resume.email && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{resume.email}</span>
                </span>
              )}

              {resume.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span>{resume.phone}</span>
                </span>
              )}
            </div>
          </div>
        </Link>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(resume.id);
          }}
          className="shrink-0 rounded-lg p-2 text-ink-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label={`Delete ${resume.candidate_name}`}
          title="Delete candidate"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Skills */}
      <div className="mt-4 min-h-[28px]">
        {resume.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}

            {extraSkillCount > 0 && (
              <Badge tone="signal">+{extraSkillCount} more</Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-ink-300">
            No skills extracted
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-300">
            Added
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-500">
            {formatDate(resume.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Link
            to={`/resumes/${resume.id}`}
            className="rounded-md p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink"
            aria-label={`View ${resume.candidate_name}`}
            title="View resume"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <Link
            to={`/resumes/${resume.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-ink-700 hover:shadow-sm"
          >
            <FileText className="h-3.5 w-3.5" />
            View resume
          </Link>
        </div>
      </div>
    </div>
  );
}

