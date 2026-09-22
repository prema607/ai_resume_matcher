import { useCallback, useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ResumeCard } from "@/components/ResumeCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { resumesApi, ApiError } from "@/lib/api";
import type { ResumeListItem } from "@/lib/types";

const PAGE_SIZE = 12;

export function ResumesPage() {
  const [items, setItems] = useState<ResumeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { notify } = useToast();

  const load = useCallback(async (currentSkip: number, currentSearch: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await resumesApi.list({
        skip: currentSkip,
        limit: PAGE_SIZE,
        search: currentSearch || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load candidates.");
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
      await resumesApi.remove(pendingDeleteId);
      notify("Resume deleted.");
      setPendingDeleteId(null);
      load(skip, search);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete this resume.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const hasMore = skip + PAGE_SIZE < total;
  const hasPrev = skip > 0;

  return (
    <>
      <TopBar title="Candidates" subtitle={`${total} resume${total === 1 ? "" : "s"} in the pool`} />
      <div className="space-y-6 px-5 py-6 md:px-8">
        <UploadDropzone onUploaded={() => load(0, search)} />

        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSkip(0);
            }}
            placeholder="Search by name…"
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
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={search ? "No matching candidates" : "No candidates yet"}
            description={
              search
                ? "Try a different name, or clear the search to see everyone."
                : "Upload a resume PDF above to parse it and add it to the pool."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((resume) => (
                <ResumeCard key={resume.id} resume={resume} onDelete={setPendingDeleteId} />
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
                <Button
                  variant="secondary"
                  disabled={!hasMore}
                  onClick={() => setSkip(skip + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this resume?"
        description="This permanently removes the candidate's parsed data, embedding, and stored PDF."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}
