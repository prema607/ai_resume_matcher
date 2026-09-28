import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  Radar,
  Save,
  Briefcase,
  Code2,
  Sparkles,
  X,
} from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { jobsApi, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { JobDescriptionResponse } from "@/lib/types";

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [job, setJob] = useState<JobDescriptionResponse | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    setLoading(true);
    setError(null);

    jobsApi
      .get(id)
      .then((res) => {
        if (cancelled) return;

        setJob(res);
        setTitle(res.title);
        setDescription(res.description);
        setSkillsInput(res.required_skills.join(", "));
        setDirty(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 404
              ? "This role could not be found. It may have been deleted."
              : "Could not load this role."
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

  const parsedSkills = skillsInput
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    if (!id || !job) return;

    if (title.trim().length < 2) {
      notify("Role title must be at least 2 characters.", "error");
      return;
    }

    if (description.trim().length < 20) {
      notify(
        "Description must be at least 20 characters.",
        "error"
      );
      return;
    }

    setSaving(true);

    try {
      const required_skills = parsedSkills;

      const updated = await jobsApi.update(id, {
        title: title.trim(),
        description: description.trim(),
        required_skills,
      });

      setJob(updated);
      setTitle(updated.title);
      setDescription(updated.description);
      setSkillsInput(updated.required_skills.join(", "));
      setDirty(false);

      notify("Role updated and re-embedded.");
    } catch (err) {
      notify(
        err instanceof ApiError
          ? err.message
          : "Could not save changes.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);

    try {
      await jobsApi.remove(id);
      notify("Role deleted.");
      navigate("/jobs");
    } catch (err) {
      notify(
        err instanceof ApiError
          ? err.message
          : "Could not delete this role.",
        "error"
      );
      setDeleting(false);
    }
  };

  return (
    <>
      <TopBar
        title="Role details"
        subtitle={
          job
            ? "Review requirements and find candidates for this role."
            : "Role details"
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate("/jobs")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {job && (
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

        {loading && !error && <JobDetailSkeleton />}

        {job && (
          <>
            {/* Role overview */}
            <section className="card overflow-hidden">
              <div className="p-6 md:p-7">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-signal/10 text-signal">
                      <Briefcase className="h-6 w-6" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
                          {job.title}
                        </h2>

                        <span className="inline-flex items-center gap-1 rounded-full bg-signal/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-signal">
                          <Sparkles className="h-3 w-3" />
                          AI matching
                        </span>
                      </div>

                      <p className="mt-2 font-mono text-[11px] text-ink-300">
                        Posted {formatDate(job.created_at)}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/search?job_id=${job.id}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink/90"
                  >
                    <Radar className="h-4 w-4" />
                    Find matching candidates
                  </Link>
                </div>

                {/* Role stats */}
                <div className="mt-7 grid grid-cols-2 gap-3 border-t border-line-subtle pt-5 sm:grid-cols-3">
                  <RoleStat
                    icon={<Code2 className="h-4 w-4" />}
                    label="Required skills"
                    value={job.required_skills.length}
                  />

                  <RoleStat
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Role type"
                    value="Open role"
                  />

                  <RoleStat
                    icon={<Sparkles className="h-4 w-4" />}
                    label="Matching"
                    value="AI powered"
                  />
                </div>
              </div>
            </section>

            {/* Requirements preview */}
            <section className="card p-6 md:p-7">
              <SectionHeader
                icon={<Code2 className="h-4 w-4" />}
                title="Required skills"
                count={job.required_skills.length}
              />

              {job.required_skills.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {job.required_skills.map((skill) => (
                    <Badge key={skill} tone="signal">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-500">
                  No explicit required skills were added. Matching will
                  rely primarily on semantic similarity.
                </p>
              )}
            </section>

            {/* Description */}
            <section className="card p-6 md:p-7">
              <SectionHeader
                icon={<Briefcase className="h-4 w-4" />}
                title="Role description"
              />

              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-ink-700">
                {job.description}
              </p>
            </section>

            {/* Edit form */}
            <form
              onSubmit={handleSave}
              className="card overflow-hidden"
            >
              <div className="border-b border-line-subtle bg-paper-100 px-6 py-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
                    <Save className="h-4 w-4" />
                  </div>

                  <div>
                    <h3 className="font-display text-sm font-semibold text-ink">
                      Edit role
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-ink-500">
                      Updating the role regenerates its embedding so
                      future candidate matches use the latest requirements.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 p-6">
                {/* Title */}
                <div>
                  <label
                    htmlFor="edit-title"
                    className="mb-1.5 block text-xs font-medium text-ink-500"
                  >
                    Role title
                  </label>

                  <input
                    id="edit-title"
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setDirty(true);
                    }}
                    className="input-field"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="edit-description"
                    className="mb-1.5 block text-xs font-medium text-ink-500"
                  >
                    Description
                  </label>

                  <textarea
                    id="edit-description"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setDirty(true);
                    }}
                    className="input-field min-h-[170px] resize-y"
                    required
                  />

                  <div className="mt-1.5 flex justify-end text-[11px] text-ink-300">
                    {description.length} characters
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label
                    htmlFor="edit-skills"
                    className="mb-1.5 block text-xs font-medium text-ink-500"
                  >
                    Required skills
                    <span className="text-ink-300">
                      {" "}
                      (comma-separated)
                    </span>
                  </label>

                  <input
                    id="edit-skills"
                    type="text"
                    value={skillsInput}
                    onChange={(e) => {
                      setSkillsInput(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Python, FastAPI, MongoDB"
                    className="input-field"
                  />

                  {parsedSkills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {parsedSkills.map((skill, index) => (
                        <Badge key={`${skill}-${index}`}>
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save area */}
                <div className="flex flex-col gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-ink-500">
                    {dirty
                      ? "You have unsaved changes."
                      : "No unsaved changes."}
                  </p>

                  <div className="flex gap-2">
                    {dirty && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={saving}
                        onClick={() => {
                          setTitle(job.title);
                          setDescription(job.description);
                          setSkillsInput(
                            job.required_skills.join(", ")
                          );
                          setDirty(false);
                        }}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    )}

                    <Button
                      type="submit"
                      loading={saving}
                      disabled={!dirty}
                    >
                      <Save className="h-4 w-4" />
                      Save changes
                    </Button>
                  </div>
                </div>
              </div>
            </form>

            {/* Matching CTA */}
            <section className="rounded-2xl bg-ink p-6 text-white md:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Radar className="h-5 w-5" />
                    <h3 className="font-display text-base font-semibold">
                      Ready to find candidates?
                    </h3>
                  </div>

                  <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/60">
                    Run the AI matcher to compare your candidate pool
                    against this role using semantic fit and required
                    skills.
                  </p>
                </div>

                <Link
                  to={`/search?job_id=${job.id}`}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
                >
                  <Radar className="h-4 w-4" />
                  Match candidates
                </Link>
              </div>
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this role?"
        description="This permanently removes the role and its embedding."
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

function RoleStat({
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

function JobDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card space-y-5 p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />

          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>

        <Skeleton className="h-16 w-full" />
      </div>

      <div className="card space-y-4 p-6">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}