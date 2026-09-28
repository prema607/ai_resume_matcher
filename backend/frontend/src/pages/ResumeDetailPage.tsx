import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  ArrowLeft,
  Trash2,
  FileText,
  Search,
  Code2,
  CalendarDays,
  UserRound,
  ChevronDown,
} from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { resumesApi, ApiError } from "@/lib/api";
import { formatDate, initials } from "@/lib/utils";
import type { ResumeDetail } from "@/lib/types";

export function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    resumesApi
      .get(id)
      .then((res) => {
        if (!cancelled) {
          setResume(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "This resume could not be found. It may have been deleted."
              : "Could not load this resume."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);

    try {
      await resumesApi.remove(id);
      notify("Resume deleted.");
      navigate("/resumes");
    } catch (err) {
      notify(
        err instanceof ApiError
          ? err.message
          : "Could not delete this resume.",
        "error"
      );
      setDeleting(false);
    }
  };

  const parsed = resume?.parsed_json;

  return (
    <>
      <TopBar
        title="Candidate profile"
        subtitle={
          resume
            ? "Review parsed candidate information and experience."
            : "Candidate details"
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate("/resumes")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {resume && (
              <Button
                variant="danger"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 md:px-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && !error && <ProfileSkeleton />}

        {resume && parsed && (
          <>
            {/* Candidate header */}
            <section className="card overflow-hidden">
              <div className="p-6 md:p-7">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-lg font-semibold text-white shadow-sm">
                      {initials(resume.candidate_name)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
                          {resume.candidate_name}
                        </h2>

                        <span className="inline-flex items-center gap-1 rounded-full bg-signal/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-signal">
                          <UserRound className="h-3 w-3" />
                          Candidate
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 text-sm text-ink-500 sm:flex-row sm:flex-wrap sm:gap-x-5">
                        {resume.email && (
                          <a
                            href={`mailto:${resume.email}`}
                            className="flex items-center gap-2 transition-colors hover:text-signal"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {resume.email}
                          </a>
                        )}

                        {resume.phone && (
                          <a
                            href={`tel:${resume.phone}`}
                            className="flex items-center gap-2 transition-colors hover:text-signal"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {resume.phone}
                          </a>
                        )}
                      </div>

                      <p className="mt-3 font-mono text-[11px] text-ink-300">
                        Added {formatDate(resume.created_at)}
                        {parsed.total_experience_years !== null &&
                          ` · ~${parsed.total_experience_years} yrs experience`}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => navigate("/search")}
                    className="shrink-0"
                  >
                    <Search className="h-4 w-4" />
                    Match against a role
                  </Button>
                </div>

                {/* Candidate stats */}
                <div className="mt-7 grid grid-cols-2 gap-3 border-t border-line-subtle pt-5 sm:grid-cols-4">
                  <InfoStat
                    icon={<Code2 className="h-4 w-4" />}
                    label="Skills"
                    value={parsed.skills.length}
                  />

                  <InfoStat
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Experience"
                    value={parsed.experience.length}
                  />

                  <InfoStat
                    icon={<GraduationCap className="h-4 w-4" />}
                    label="Education"
                    value={parsed.education.length}
                  />

                  <InfoStat
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Experience"
                    value={
                      parsed.total_experience_years !== null
                        ? `${parsed.total_experience_years} yrs`
                        : "—"
                    }
                  />
                </div>
              </div>
            </section>

            {/* Summary */}
            {parsed.summary && (
              <section className="card p-6 md:p-7">
                <SectionHeader
                  icon={<UserRound className="h-4 w-4" />}
                  title="Professional summary"
                />

                <p className="mt-4 max-w-4xl text-sm leading-7 text-ink-700">
                  {parsed.summary}
                </p>
              </section>
            )}

            {/* Skills */}
            {parsed.skills.length > 0 && (
              <section className="card p-6 md:p-7">
                <SectionHeader
                  icon={<Code2 className="h-4 w-4" />}
                  title="Skills"
                  count={parsed.skills.length}
                />

                <div className="mt-5 flex flex-wrap gap-2">
                  {parsed.skills.map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Experience */}
            {parsed.experience.length > 0 && (
              <section className="card p-6 md:p-7">
                <SectionHeader
                  icon={<Briefcase className="h-4 w-4" />}
                  title="Experience"
                  count={parsed.experience.length}
                />

                <div className="mt-6 space-y-6">
                  {parsed.experience.map((exp, i) => (
                    <div
                      key={i}
                      className="relative border-l-2 border-line pl-6"
                    >
                      <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-paper bg-signal" />

                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-ink">
                            {exp.role || "Role not specified"}
                          </h4>

                          {exp.company && (
                            <p className="mt-0.5 text-sm text-ink-500">
                              {exp.company}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 font-mono text-[10px] text-ink-300">
                          {exp.start_date ?? "—"} –{" "}
                          {exp.end_date ?? "Present"}
                        </span>
                      </div>

                      {exp.description && (
                        <p className="mt-3 text-sm leading-6 text-ink-700">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education */}
            {parsed.education.length > 0 && (
              <section className="card p-6 md:p-7">
                <SectionHeader
                  icon={<GraduationCap className="h-4 w-4" />}
                  title="Education"
                  count={parsed.education.length}
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {parsed.education.map((ed, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-line-subtle bg-paper-100 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-signal shadow-sm">
                          <GraduationCap className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {ed.degree || "Degree not specified"}
                          </p>

                          <p className="mt-1 text-sm text-ink-500">
                            {ed.institution || "Institution not specified"}
                          </p>

                          <p className="mt-2 font-mono text-[10px] text-ink-300">
                            {ed.start_year ?? "—"} – {ed.end_year ?? "—"}
                            {ed.grade && ` · ${ed.grade}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Raw extracted text */}
            <details className="card overflow-hidden group">
              <summary className="flex cursor-pointer list-none items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/10 text-signal">
                    <FileText className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink">
                      Raw extracted text
                    </h3>

                    <p className="mt-0.5 text-xs text-ink-500">
                      Original text extracted from the uploaded PDF
                    </p>
                  </div>
                </div>

                <ChevronDown className="h-4 w-4 text-ink-300 transition-transform group-open:rotate-180" />
              </summary>

              <div className="border-t border-line-subtle p-6">
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-paper-100 p-4 font-mono text-xs leading-relaxed text-ink-700">
                  {resume.raw_text}
                </pre>
              </div>
            </details>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this resume?"
        description="This permanently removes the candidate's parsed data, embedding, and stored PDF."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <span className="text-signal">{icon}</span>
        {title}
      </h3>

      {count !== undefined && (
        <span className="font-mono text-[10px] text-ink-300">
          {count} item{count === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

function InfoStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-line-subtle bg-paper-100 p-3">
      <div className="flex items-center gap-2 text-ink-300">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>

      <p className="mt-2 font-display text-lg font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card space-y-5 p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />

          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>

        <Skeleton className="h-20 w-full" />
      </div>

      <div className="card space-y-4 p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>

      <div className="card space-y-4 p-6">
        <Skeleton className="h-5 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
    </div>
  );
}