import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, Briefcase, Plus, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { JobCard } from "@/components/JobCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
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

  const load = useCallback(async (currentSkip: number, currentSearch: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await jobsApi.list({
        skip: currentSkip,
        limit: PAGE_SIZE,
        search: currentSearch || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      load(skip, search);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete this role.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const hasMore = skip + PAGE_SIZE < total;
  const hasPrev = skip > 0;

  return (
    <>
      <TopBar
        title="Roles"
        subtitle={`${total} open role${total === 1 ? "" : "s"}`}
        actions={
          <Button onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? "Close" : "New role"}
          </Button>
        }
      />

      <div className="space-y-6 px-5 py-6 md:px-8">
        {formOpen && (
          <CreateJobForm
            onCreated={() => {
              setFormOpen(false);
              load(0, search);
            }}
          />
        )}

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search by title…"
            className="input-field pl-9"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-5 w-5" />}
            title={search ? "No matching roles" : "No roles posted yet"}
            description={
              search
                ? "Try a different title, or clear the search to see everyone."
                : "Post a role to start ranking candidates against it."
            }
            action={
              !search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" /> New role
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((job) => (
                <JobCard key={job.id} job={job} onDelete={setPendingDeleteId} />
              ))}
            </div>

            {(hasPrev || hasMore) && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="secondary"
                  disabled={!hasPrev}
                  onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <span className="font-mono text-xs text-ink-500">
                  {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
                </span>
                <Button variant="secondary" disabled={!hasMore} onClick={() => setSkip(skip + PAGE_SIZE)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (title.trim().length < 2) {
      setFormError("Title must be at least 2 characters.");
      return;
    }
    if (description.trim().length < 20) {
      setFormError("Description must be at least 20 characters so the match embedding has enough signal.");
      return;
    }

    setSubmitting(true);
    try {
      const required_skills = skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const job = await jobsApi.create({ title: title.trim(), description: description.trim(), required_skills });
      notify(`“${job.title}” was posted.`);
      setTitle("");
      setDescription("");
      setSkillsInput("");
      onCreated();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create this role.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card animate-fade-up space-y-4 p-6">
      <div>
        <label htmlFor="job-title" className="mb-1.5 block text-xs font-medium text-ink-500">
          Title
        </label>
        <input
          id="job-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Senior Backend Engineer"
          className="input-field"
          required
        />
      </div>

      <div>
        <label htmlFor="job-description" className="mb-1.5 block text-xs font-medium text-ink-500">
          Description
        </label>
        <textarea
          id="job-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the role, responsibilities, and what a strong candidate looks like…"
          className="input-field min-h-[120px] resize-y"
          required
        />
      </div>

      <div>
        <label htmlFor="job-skills" className="mb-1.5 block text-xs font-medium text-ink-500">
          Required skills <span className="text-ink-300">(comma-separated)</span>
        </label>
        <input
          id="job-skills"
          type="text"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          placeholder="Python, FastAPI, MongoDB"
          className="input-field"
        />
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          Post role
        </Button>
      </div>
    </form>
  );
}
