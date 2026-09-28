
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Users,
  UploadCloud,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ResumeCard } from "@/components/ResumeCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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

  const load = useCallback(
    async (currentSkip: number, currentSearch: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await resumesApi.list({
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
            : "Could not load candidates."
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
      await resumesApi.remove(pendingDeleteId);

      notify("Resume deleted.");
      setPendingDeleteId(null);

      /*
       * If the last item on the current page was deleted,
       * move back one page when necessary.
       */
      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - PAGE_SIZE));
      } else {
        load(skip, search);
      }
    } catch (err) {
      notify(
        err instanceof ApiError
          ? err.message
          : "Could not delete this resume.",
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
        title="Candidates"
        subtitle={
          total === 0
            ? "Build your candidate pool by uploading resumes."
            : `${total} resume${total === 1 ? "" : "s"} in your candidate pool`
        }
      />

      <div className="space-y-7 px-5 py-6 md:px-8">
        {/* Upload section */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Add candidates</p>

              <p className="mt-1 text-sm text-ink-500">
                Upload PDF resumes and let the system extract candidate
                information automatically.
              </p>
            </div>

            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal sm:flex">
              <UploadCloud className="h-4 w-4" />
            </div>
          </div>

          <UploadDropzone onUploaded={() => load(0, search)} />
        </section>

        {/* Candidate list header */}
        <section>
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="eyebrow">Candidate pool</p>

                {!loading && (
                  <Badge tone="signal">
                    {total}
                  </Badge>
                )}
              </div>

              <h2 className="mt-1 font-display text-lg font-semibold text-ink">
                Browse candidates
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Search resumes and open a candidate to view their complete
                profile.
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
                placeholder="Search candidates by name…"
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
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={
                search
                  ? "No matching candidates"
                  : "No candidates yet"
              }
              description={
                search
                  ? "Try a different name, or clear the search to see everyone."
                  : "Upload a resume PDF above to parse it and add it to your candidate pool."
              }
            />
          ) : (
            <>
              {/* Candidate cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((resume) => (
                  <ResumeCard
                    key={resume.id}
                    resume={resume}
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
        title="Delete this resume?"
        description="This permanently removes the candidate's parsed data, embedding, and stored PDF."
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

