import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mail, Phone, GraduationCap, Briefcase, ArrowLeft, Trash2, FileText } from "lucide-react";
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
    resumesApi
      .get(id)
      .then((res) => !cancelled && setResume(res))
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "This resume could not be found. It may have been deleted."
              : "Could not load this resume."
          );
        }
      })
      .finally(() => !cancelled && setLoading(false));
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
      notify(err instanceof ApiError ? err.message : "Could not delete this resume.", "error");
      setDeleting(false);
    }
  };

  return (
    <>
      <TopBar
        title="Candidate"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/resumes")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {resume && (
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 md:px-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="card space-y-4 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {resume && (
          <>
            <div className="card p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-sm font-semibold text-white">
                  {initials(resume.candidate_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {resume.candidate_name}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-500">
                    {resume.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> {resume.email}
                      </span>
                    )}
                    {resume.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {resume.phone}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-ink-300">
                    Added {formatDate(resume.created_at)}
                    {resume.parsed_json.total_experience_years !== null &&
                      ` · ~${resume.parsed_json.total_experience_years} yrs experience`}
                  </p>
                </div>
              </div>

              <p className="mt-5 border-t border-line-subtle pt-4 text-sm leading-relaxed text-ink-700">
                {resume.parsed_json.summary}
              </p>

              {resume.parsed_json.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {resume.parsed_json.skills.map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
              )}
            </div>

            {resume.parsed_json.experience.length > 0 && (
              <div className="card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <Briefcase className="h-4 w-4 text-signal" /> Experience
                </h3>
                <ol className="space-y-4">
                  {resume.parsed_json.experience.map((exp, i) => (
                    <li key={i} className="border-l-2 border-line pl-4">
                      <p className="text-sm font-medium text-ink">
                        {exp.role} <span className="text-ink-500">· {exp.company}</span>
                      </p>
                      <p className="font-mono text-[11px] text-ink-300">
                        {exp.start_date ?? "—"} – {exp.end_date ?? "Present"}
                      </p>
                      {exp.description && (
                        <p className="mt-1 text-sm text-ink-700">{exp.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {resume.parsed_json.education.length > 0 && (
              <div className="card p-6">
                <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-ink">
                  <GraduationCap className="h-4 w-4 text-signal" /> Education
                </h3>
                <ol className="space-y-4">
                  {resume.parsed_json.education.map((ed, i) => (
                    <li key={i} className="border-l-2 border-line pl-4">
                      <p className="text-sm font-medium text-ink">{ed.degree}</p>
                      <p className="text-sm text-ink-500">{ed.institution}</p>
                      <p className="font-mono text-[11px] text-ink-300">
                        {ed.start_year ?? "—"} – {ed.end_year ?? "—"}
                        {ed.grade && ` · ${ed.grade}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <details className="card overflow-hidden p-6">
              <summary className="flex cursor-pointer items-center gap-2 font-display text-sm font-semibold text-ink">
                <FileText className="h-4 w-4 text-signal" /> Raw extracted text
              </summary>
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-paper-100 p-4 font-mono text-xs leading-relaxed text-ink-700">
                {resume.raw_text}
              </pre>
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
