import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Radar, Briefcase, Type, Mail, Phone, SlidersHorizontal } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchRadar } from "@/components/MatchRadar";
import { useToast } from "@/components/ui/Toast";
import { jobsApi, searchApi, ApiError } from "@/lib/api";
import { cx } from "@/lib/utils";
import type { JobDescriptionResponse, MatchResult } from "@/lib/types";

type Mode = "job" | "text";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedJobId = searchParams.get("job_id");

  const [mode, setMode] = useState<Mode>(preselectedJobId ? "job" : "job");
  const [jobs, setJobs] = useState<JobDescriptionResponse[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(preselectedJobId ?? "");
  const [queryText, setQueryText] = useState("");
  const [limit, setLimit] = useState(10);
  const [minScore, setMinScore] = useState(0);
  const [showTuning, setShowTuning] = useState(false);

  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    jobsApi
      .list({ limit: 100 })
      .then((res) => setJobs(res.items))
      .catch(() => notify("Could not load roles for selection.", "error"))
      .finally(() => setJobsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      setError(null);

      if (mode === "job" && !selectedJobId) {
        setError("Choose a role to match candidates against.");
        return;
      }
      if (mode === "text" && queryText.trim().length < 10) {
        setError("Describe the role in at least 10 characters so the match has enough signal.");
        return;
      }

      setSearching(true);
      setResults(null);
      try {
        const payload = {
          limit,
          num_candidates: Math.max(100, limit * 10),
          min_score: minScore > 0 ? minScore : null,
        };
        const res =
          mode === "job"
            ? await searchApi.byJob({ job_id: selectedJobId, ...payload })
            : await searchApi.byText({ query_text: queryText.trim(), ...payload });
        setResults(res.results);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Search failed. Please try again."
        );
      } finally {
        setSearching(false);
      }
    },
    [mode, selectedJobId, queryText, limit, minScore]
  );

  // Auto-run once when arriving with a preselected job (e.g. from a job card's "Find matches").
  useEffect(() => {
    if (preselectedJobId && jobs.length > 0 && results === null && !searching) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedJobId, jobs.length]);

  const handleModeChange = (next: Mode) => {
    setMode(next);
    setResults(null);
    setError(null);
    if (next === "text") {
      searchParams.delete("job_id");
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <>
      <TopBar title="Match" subtitle="Rank stored candidates by semantic fit to a role." />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6 md:px-8">
        <form onSubmit={runSearch} className="card space-y-5 p-6">
          <div className="flex gap-2">
            <ModeTab
              active={mode === "job"}
              onClick={() => handleModeChange("job")}
              icon={<Briefcase className="h-3.5 w-3.5" />}
              label="Saved role"
            />
            <ModeTab
              active={mode === "text"}
              onClick={() => handleModeChange("text")}
              icon={<Type className="h-3.5 w-3.5" />}
              label="Free text"
            />
          </div>

          {mode === "job" ? (
            jobsLoading ? (
              <Skeleton className="h-11 w-full" />
            ) : jobs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink-500">
                No roles saved yet.{" "}
                <Link to="/jobs" className="text-signal hover:text-signal-600">
                  Post one first
                </Link>{" "}
                or switch to free text.
              </p>
            ) : (
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="input-field"
              >
                <option value="" disabled>
                  Select a role…
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            )
          ) : (
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Paste or describe the role's requirements — responsibilities, must-have skills, seniority…"
              className="input-field min-h-[120px] resize-y"
            />
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowTuning((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {showTuning ? "Hide" : "Show"} search tuning
            </button>
            {showTuning && (
              <div className="mt-3 grid grid-cols-1 gap-4 rounded-lg bg-paper-100 p-4 sm:grid-cols-2">
                <label className="text-xs font-medium text-ink-500">
                  Results to return
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value) || 10)}
                    className="input-field mt-1.5"
                  />
                </label>
                <label className="text-xs font-medium text-ink-500">
                  Minimum score ({Math.round(minScore * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.05}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="mt-3.5 w-full accent-signal"
                  />
                </label>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" loading={searching}>
              <Radar className="h-4 w-4" /> Run match
            </Button>
          </div>
        </form>

        {searching && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!searching && results !== null && (
          results.length === 0 ? (
            <EmptyState
              icon={<Radar className="h-5 w-5" />}
              title="No matches above the threshold"
              description="Try lowering the minimum score, broadening the role description, or uploading more resumes."
            />
          ) : (
            <div className="space-y-3">
              <p className="eyebrow">
                {results.length} ranked candidate{results.length === 1 ? "" : "s"}
              </p>
              {results.map((match, i) => (
                <MatchResultRow key={match.id} rank={i + 1} match={match} />
              ))}
            </div>
          )
        )}
      </div>
    </>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        active ? "bg-ink text-white" : "bg-paper-100 text-ink-500 hover:text-ink"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MatchResultRow({ rank, match }: { rank: number; match: MatchResult }) {
  const visibleSkills = match.parsed_json.skills.slice(0, 5);
  const extraCount = match.parsed_json.skills.length - visibleSkills.length;

  return (
    <Link
      to={`/resumes/${match.id}`}
      className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-lift sm:p-5"
    >
      <span className="w-6 shrink-0 text-center font-mono text-xs text-ink-300">{rank}</span>
      <MatchRadar score={match.score} size={56} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-sm font-semibold text-ink">
          {match.candidate_name}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          {match.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3 shrink-0" /> {match.email}
            </span>
          )}
          {match.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" /> {match.phone}
            </span>
          )}
        </div>
        {visibleSkills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleSkills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
            {extraCount > 0 && <Badge tone="signal">+{extraCount} more</Badge>}
          </div>
        )}
      </div>
    </Link>
  );
}
