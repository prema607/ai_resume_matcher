import { Link } from "react-router-dom";
import { Trash2, Mail, Phone } from "lucide-react";
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
    <div className="card group relative flex flex-col gap-4 p-5 transition-shadow hover:shadow-lift">
      <Link to={`/resumes/${resume.id}`} className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-xs font-semibold text-white">
          {initials(resume.candidate_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-sm font-semibold text-ink">
            {resume.candidate_name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            {resume.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3 w-3 shrink-0" /> {resume.email}
              </span>
            )}
            {resume.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" /> {resume.phone}
              </span>
            )}
          </div>
        </div>
      </Link>

      {resume.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => (
            <Badge key={skill}>{skill}</Badge>
          ))}
          {extraSkillCount > 0 && <Badge tone="signal">+{extraSkillCount} more</Badge>}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line-subtle pt-3">
        <span className="font-mono text-[11px] text-ink-300">
          Added {formatDate(resume.created_at)}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete(resume.id);
          }}
          className="rounded-md p-1.5 text-ink-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          aria-label={`Delete ${resume.candidate_name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
