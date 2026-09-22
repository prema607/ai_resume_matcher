import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Trash2, Radar, Save } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
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
    jobsApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setJob(res);
        setTitle(res.title);
        setDescription(res.description);
        setSkillsInput(res.required_skills.join(", "));
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
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !job) return;
    setSaving(true);
    try {
      const required_skills = skillsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const updated = await jobsApi.update(id, {
        title: title.trim(),
        description: description.trim(),
        required_skills,
      });
      setJob(updated);
      setDirty(false);
      notify("Role updated and re-embedded.");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save changes.", "error");
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
      notify(err instanceof ApiError ? err.message : "Could not delete this role.", "error");
      setDeleting(false);
    }
  };

  return (
    <>
      <TopBar
        title="Role"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/jobs")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {job && (
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-2xl space-y-6 px-5 py-6 md:px-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="card space-y-4 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {job && (
          <>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] text-ink-300">Posted {formatDate(job.created_at)}</p>
              <Link
                to={`/search?job_id=${job.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-signal hover:text-signal-600"
              >
                <Radar className="h-3.5 w-3.5" /> Find matching candidates
              </Link>
            </div>

            <form onSubmit={handleSave} className="card space-y-4 p-6">
              <div>
                <label htmlFor="edit-title" className="mb-1.5 block text-xs font-medium text-ink-500">
                  Title
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

              <div>
                <label htmlFor="edit-description" className="mb-1.5 block text-xs font-medium text-ink-500">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDirty(true);
                  }}
                  className="input-field min-h-[160px] resize-y"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-skills" className="mb-1.5 block text-xs font-medium text-ink-500">
                  Required skills <span className="text-ink-300">(comma-separated)</span>
                </label>
                <input
                  id="edit-skills"
                  type="text"
                  value={skillsInput}
                  onChange={(e) => {
                    setSkillsInput(e.target.value);
                    setDirty(true);
                  }}
                  className="input-field"
                />
              </div>

              <div className="flex items-center justify-between border-t border-line-subtle pt-4">
                <p className="text-xs text-ink-500">
                  {dirty ? "Saving re-generates this role's match embedding." : "No unsaved changes."}
                </p>
                <Button type="submit" loading={saving} disabled={!dirty}>
                  <Save className="h-4 w-4" /> Save changes
                </Button>
              </div>
            </form>
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
