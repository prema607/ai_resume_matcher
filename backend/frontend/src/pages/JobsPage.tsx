import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Search,
  Briefcase,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Code2,
} from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { JobCard } from "@/components/JobCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { jobsApi, ApiError } from "@/lib/api";
import type { JobDescriptionResponse } from "@/lib/types";

const PAGE_SIZE = 9;

export function JobsPage() {
  const [items, setItems] = useState<JobDescriptionResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { notify } = useToast();

  const load = useCallback(
    async (currentSkip: number, currentSearch: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await jobsApi.list({
          skip: currentSkip,
          limit: PAGE_SIZE,
          search: currentSearch.trim() || undefined,
        });

        setItems(res.items);
        setTotal(res.total);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load roles."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(skip, search);
  }, [load, skip, search]);

  const handleDelete = async () => {
    if (!pendingDeleteId) return;

    setDeleting(true);

    try {
      await jobsApi.remove(pendingDeleteId);

      notify("Role deleted.");
      setPendingDeleteId(null);

      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - PAGE_SIZE));
      } else {
        load(skip, search);
      }
    } catch (err) {
      notify(
        err instanceof ApiError
          ? err.message
          : "Could not delete this role.",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearSearch = () => {
    setSearch("");
    setSkip(0);
  };

  const hasMore = skip + PAGE_SIZE < total;
  const hasPrev = skip > 0;

  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = Math.min(skip + PAGE_SIZE, total);

  return (
    <>
      <TopBar
        title="Roles"
        subtitle={
          total === 0
            ? "Create a role to start matching candidates."
            : `${total} open role${total === 1 ? "" : "s"}`
        }
        actions={
          <Button onClick={() => setFormOpen((value) => !value)}>
            {formOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {formOpen ? "Close" : "New role"}
          </Button>
        }
      />

      <div className="space-y-7 px-5 py-6 md:px-8">
        {/* Create role */}
        {formOpen && (
          <CreateJobForm
            onCreated={() => {
              setFormOpen(false);
              setSkip(0);
              load(0, search);
            }}
          />
        )}

        {/* Role browser */}
        <section>
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="eyebrow">Role library</p>

                {!loading && (
                  <Badge tone="signal">
                    {total}
                  </Badge>
                )}
              </div>

              <h2 className="mt-1 font-display text-lg font-semibold text-ink">
                Browse roles
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Create job requirements and use them to find suitable
                candidates.
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />

              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSkip(0);
                }}
                placeholder="Search roles by title…"
                className="input-field pl-9 pr-9"
              />

              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 transition-colors hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search status */}
          {search && !loading && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-line-subtle bg-paper-100 px-3 py-2.5 text-xs text-ink-500">
              <Search className="h-3.5 w-3.5" />

              <span>
                Showing{" "}
                <strong className="font-semibold text-ink">
                  {total}
                </strong>{" "}
                result{total === 1 ? "" : "s"} for{" "}
                <strong className="font-semibold text-ink">
                  “{search}”
                </strong>
              </span>

              <button
                type="button"
                onClick={clearSearch}
                className="ml-auto font-medium text-signal hover:text-signal-600"
              >
                Clear
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title={
                search
                  ? "No matching roles"
                  : "No roles posted yet"
              }
              description={
                search
                  ? "Try a different title, or clear the search to see all roles."
                  : "Create your first role with a description and required skills."
              }
              action={
                !search && (
                  <Button onClick={() => setFormOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New role
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Role cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onDelete={setPendingDeleteId}
                  />
                ))}
              </div>

              {/* Pagination */}
              {(hasPrev || hasMore) && (
                <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line-subtle bg-paper-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="secondary"
                    disabled={!hasPrev}
                    onClick={() =>
                      setSkip(Math.max(0, skip - PAGE_SIZE))
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xs text-ink-500">
                      {rangeStart}–{rangeEnd} of {total}
                    </span>

                    <span className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-300">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    disabled={!hasMore}
                    onClick={() => setSkip(skip + PAGE_SIZE)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this role?"
        description="This permanently removes the role and its embedding. Past search results referencing it will no longer resolve."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function CreateJobForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { notify } = useToast();

  const parsedSkills = skillsInput
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (title.trim().length < 2) {
      setFormError("Title must be at least 2 characters.");
      return;
    }

    if (description.trim().length < 20) {
      setFormError(
        "Description must be at least 20 characters so the match embedding has enough signal."
      );
      return;
    }

    setSubmitting(true);

    try {
      const required_skills = parsedSkills;

      const job = await jobsApi.create({
        title: title.trim(),
        description: description.trim(),
        required_skills,
      });

      notify(`“${job.title}” was posted.`);

      setTitle("");
      setDescription("");
      setSkillsInput("");

      onCreated();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Could not create this role."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card animate-fade-up overflow-hidden"
    >
      {/* Form header */}
      <div className="border-b border-line-subtle bg-paper-100 px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <Sparkles className="h-4 w-4" />
          </div>

          <div>
            <h2 className="font-display text-sm font-semibold text-ink">
              Create a new role
            </h2>

            <p className="mt-1 text-xs leading-5 text-ink-500">
              Add the role details and required skills. These are used by
              the AI matching engine to compare candidates.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {/* Title */}
        <div>
          <label
            htmlFor="job-title"
            className="mb-1.5 block text-xs font-medium text-ink-500"
          >
            Role title
          </label>

          <input
            id="job-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Python Full Stack Developer"
            className="input-field"
            required
          />

          <p className="mt-1.5 text-[11px] text-ink-300">
            Use a clear job title that describes the position.
          </p>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="job-description"
            className="mb-1.5 block text-xs font-medium text-ink-500"
          >
            Role description
          </label>

          <textarea
            id="job-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe responsibilities, technologies, experience requirements, and what a strong candidate should bring…"
            className="input-field min-h-[150px] resize-y"
            required
          />

          <div className="mt-1.5 flex justify-between text-[11px] text-ink-300">
            <span>
              Include responsibilities and important requirements.
            </span>
            <span>{description.length} characters</span>
          </div>
        </div>

        {/* Skills */}
        <div>
          <label
            htmlFor="job-skills"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500"
          >
            <Code2 className="h-3.5 w-3.5 text-signal" />
            Required skills
          </label>

          <input
            id="job-skills"
            type="text"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="Python, FastAPI, MongoDB, React"
            className="input-field"
          />

          <p className="mt-1.5 text-[11px] text-ink-300">
            Separate skills with commas. These contribute strongly to the
            final match score.
          </p>

          {parsedSkills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {parsedSkills.map((skill, index) => (
                <Badge key={`${skill}-${index}`} tone="signal">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {formError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-line-subtle pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => {
              setTitle("");
              setDescription("");
              setSkillsInput("");
              setFormError(null);
            }}
          >
            Clear
          </Button>

          <Button type="submit" loading={submitting}>
            <Plus className="h-4 w-4" />
            Post role
          </Button>
        </div>
      </div>
    </form>
  );
}