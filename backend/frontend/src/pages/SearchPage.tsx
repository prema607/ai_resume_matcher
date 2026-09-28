import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Radar,
  Briefcase,
  Type,
  Mail,
  Phone,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

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

const STORAGE_KEY = "resume_matcher_last_search";

interface SavedSearchState {
  mode: Mode;
  selectedJobId: string;
  queryText: string;
  limit: number;
  minScore: number;
  threshold: number;
  results: MatchResult[] | null;
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedJobId = searchParams.get("job_id");

  const [mode, setMode] = useState<Mode>("job");
  const [jobs, setJobs] = useState<JobDescriptionResponse[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const [selectedJobId, setSelectedJobId] = useState(
    preselectedJobId ?? ""
  );

  const [queryText, setQueryText] = useState("");

  const [limit, setLimit] = useState(10);
  const [minScore, setMinScore] = useState(0);
  const [threshold, setThreshold] = useState(0.4);

  const [showTuning, setShowTuning] = useState(false);

  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { notify } = useToast();

  /*
   * Restore the previous match state when returning to this page.
   * This prevents the user from having to select the job and run
   * the same match again after viewing a candidate.
   */
  useEffect(() => {
    if (preselectedJobId) {
      return;
    }

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return;
      }

      const parsed: SavedSearchState = JSON.parse(saved);

      if (parsed.mode) {
        setMode(parsed.mode);
      }

      if (parsed.selectedJobId) {
        setSelectedJobId(parsed.selectedJobId);
      }

      if (parsed.queryText) {
        setQueryText(parsed.queryText);
      }

      if (typeof parsed.limit === "number") {
        setLimit(parsed.limit);
      }

      if (typeof parsed.minScore === "number") {
        setMinScore(parsed.minScore);
      }

      if (typeof parsed.threshold === "number") {
        setThreshold(parsed.threshold);
      }

      if (parsed.results !== null) {
        setResults(parsed.results);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [preselectedJobId]);

  /*
   * Load available jobs.
   */
  useEffect(() => {
    jobsApi
      .list({ limit: 100 })
      .then((res) => setJobs(res.items))
      .catch(() => notify("Could not load roles for selection.", "error"))
      .finally(() => setJobsLoading(false));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Save the current match state so it survives navigation
   * to a candidate detail page and back.
   */
  useEffect(() => {
    if (results === null) {
      return;
    }

    const stateToSave: SavedSearchState = {
      mode,
      selectedJobId,
      queryText,
      limit,
      minScore,
      threshold,
      results,
    };

    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(stateToSave)
    );
  }, [
    mode,
    selectedJobId,
    queryText,
    limit,
    minScore,
    threshold,
    results,
  ]);

  const runSearch = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      setError(null);

      if (mode === "job" && !selectedJobId) {
        setError("Choose a role to match candidates against.");
        return;
      }

      if (mode === "text" && queryText.trim().length < 10) {
        setError(
          "Describe the role in at least 10 characters so the match has enough signal."
        );
        return;
      }

      setSearching(true);
      setResults(null);

      try {
        const payload = {
          limit,
          num_candidates: Math.max(100, limit * 10),
          min_score: minScore > 0 ? minScore : null,
          threshold,
        };

        const res =
          mode === "job"
            ? await searchApi.byJob({
                job_id: selectedJobId,
                ...payload,
              })
            : await searchApi.byText({
                query_text: queryText.trim(),
                ...payload,
              });

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
    [
      mode,
      selectedJobId,
      queryText,
      limit,
      minScore,
      threshold,
    ]
  );

  /*
   * Auto-run when arriving with a job_id from another page.
   *
   * Example:
   * /match?job_id=123
   *
   * If we already restored results for this exact job,
   * don't run the search again.
   */
  useEffect(() => {
    if (
      preselectedJobId &&
      jobs.length > 0 &&
      results === null &&
      !searching
    ) {
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

  /*
   * Selecting a different job should clear the old results.
   * The user can then run a new match for the new role.
   */
  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId);
    setResults(null);
    setError(null);
  };

  return (
    <>
      <TopBar
        title="Match"
        subtitle="Find and understand the candidates that best fit a role."
      />

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 md:px-8">
        {/* Search form */}
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
                <Link
                  to="/jobs"
                  className="text-signal hover:text-signal-600"
                >
                  Post one first
                </Link>{" "}
                or switch to free text.
              </p>
            ) : (
              <select
                value={selectedJobId}
                onChange={(e) => handleJobChange(e.target.value)}
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
              onChange={(e) => {
                setQueryText(e.target.value);
                setResults(null);
              }}
              placeholder="Paste or describe the role's requirements — responsibilities, must-have skills, seniority…"
              className="input-field min-h-[120px] resize-y"
            />
          )}

          {/* Search tuning */}
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
              <div className="mt-3 grid grid-cols-1 gap-4 rounded-lg bg-paper-100 p-4 sm:grid-cols-3">
                {/* Results */}
                <label className="text-xs font-medium text-ink-500">
                  Results to return

                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={limit}
                    onChange={(e) =>
                      setLimit(Number(e.target.value) || 10)
                    }
                    className="input-field mt-1.5"
                  />
                </label>

                {/* Semantic score */}
                <label className="text-xs font-medium text-ink-500">
                  Semantic minimum ({Math.round(minScore * 100)}%)

                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.05}
                    value={minScore}
                    onChange={(e) =>
                      setMinScore(Number(e.target.value))
                    }
                    className="mt-3.5 w-full accent-signal"
                  />
                </label>

                {/* Final threshold */}
                <label className="text-xs font-medium text-ink-500">
                  Match threshold ({Math.round(threshold * 100)}%)

                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.05}
                    value={threshold}
                    onChange={(e) =>
                      setThreshold(Number(e.target.value))
                    }
                    className="mt-3.5 w-full accent-signal"
                  />
                </label>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={searching}>
              <Radar className="h-4 w-4" />
              Run match
            </Button>
          </div>
        </form>

        {/* Loading */}
        {searching && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-48 w-full"
              />
            ))}
          </div>
        )}

        {/* Results */}
        {!searching && results !== null && (
          results.length === 0 ? (
            <EmptyState
              icon={<Radar className="h-5 w-5" />}
              title="No matches above the threshold"
              description="Try lowering the match threshold, lowering the semantic minimum, broadening the role description, or uploading more resumes."
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">
                    Ranked candidates
                  </p>

                  <p className="mt-1 text-sm text-ink-500">
                    {results.length} candidate
                    {results.length === 1 ? "" : "s"} above{" "}
                    {Math.round(threshold * 100)}% match threshold
                  </p>
                </div>

                <Badge tone="signal">
                  {results.length} matches
                </Badge>
              </div>

              {results.map((match, i) => (
                <MatchResultRow
                  key={match.id}
                  rank={match.rank ?? i + 1}
                  match={match}
                />
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
        active
          ? "bg-ink text-white"
          : "bg-paper-100 text-ink-500 hover:text-ink"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MatchResultRow({
  rank,
  match,
}: {
  rank: number;
  match: MatchResult;
}) {
  const parsedSkills = match.parsed_json?.skills ?? [];

  const matchedSkills = match.matched_skills ?? [];
  const missingSkills = match.missing_skills ?? [];

  const visibleSkills = parsedSkills.slice(0, 5);
  const extraCount = Math.max(
    0,
    parsedSkills.length - visibleSkills.length
  );

  return (
    <Link
      to={`/resumes/${match.id}`}
      className="card block p-5 transition-shadow hover:shadow-lift"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {/* Rank */}
        <div className="flex items-center gap-3 md:w-16 md:flex-col md:gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
            Rank
          </span>

          <span className="font-mono text-lg font-semibold text-ink">
            #{rank}
          </span>
        </div>

        {/* Score */}
        <div className="flex shrink-0 items-center gap-3">
          <MatchRadar score={match.score} size={64} />

          <div className="md:hidden">
            <MatchQualityBadge quality={match.match_quality} />
          </div>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-semibold text-ink">
                {match.candidate_name}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                {match.email && (
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    {match.email}
                  </span>
                )}

                {match.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    {match.phone}
                  </span>
                )}
              </div>
            </div>

            <div className="hidden md:block">
              <MatchQualityBadge quality={match.match_quality} />
            </div>
          </div>

          {/* Score breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ScoreMetric
              label="Final match"
              value={`${Math.round(match.score * 100)}%`}
            />

            <ScoreMetric
              label="Semantic fit"
              value={`${Math.round(match.semantic_score * 100)}%`}
            />

            <ScoreMetric
              label="Skill fit"
              value={`${Math.round(match.skill_match_score * 100)}%`}
            />
          </div>

          {/* Matched / missing skills */}
          {(matchedSkills.length > 0 || missingSkills.length > 0) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SkillGroup
                title="Matched skills"
                icon={
                  <CheckCircle2 className="h-3.5 w-3.5" />
                }
                skills={matchedSkills}
                tone="success"
              />

              <SkillGroup
                title="Skill gaps"
                icon={
                  <AlertCircle className="h-3.5 w-3.5" />
                }
                skills={missingSkills}
                tone="warning"
              />
            </div>
          )}

          {/* Candidate skills */}
          {visibleSkills.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-300">
                Resume skills
              </p>

              <div className="flex flex-wrap gap-1.5">
                {visibleSkills.map((skill) => (
                  <Badge key={skill}>
                    {skill}
                  </Badge>
                ))}

                {extraCount > 0 && (
                  <Badge tone="signal">
                    +{extraCount} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {match.recommended_action && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-paper-100 px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  Recommendation
                </p>

                <p className="mt-0.5 text-xs font-medium text-ink">
                  {match.recommended_action}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function ScoreMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-paper-100 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
        {label}
      </p>

      <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

function MatchQualityBadge({
  quality,
}: {
  quality: string;
}) {
  const normalized = quality.toLowerCase();

  if (normalized.includes("top")) {
    return (
      <Badge tone="signal">
        Top Tier
      </Badge>
    );
  }

  if (normalized.includes("moderate")) {
    return (
      <Badge>
        Moderate Fit
      </Badge>
    );
  }

  if (normalized.includes("low")) {
    return (
      <Badge>
        Low Fit
      </Badge>
    );
  }

  return (
    <Badge>
      {quality || "Unclassified"}
    </Badge>
  );
}

function SkillGroup({
  title,
  icon,
  skills,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  skills: string[];
  tone: "success" | "warning";
}) {
  return (
    <div>
      <div
        className={cx(
          "mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider",
          tone === "success"
            ? "text-emerald-600"
            : "text-amber-600"
        )}
      >
        {icon}
        {title}
      </div>

      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={skill}
              className={cx(
                "rounded-md px-2 py-1 text-[11px] font-medium",
                tone === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-ink-400">
          None identified
        </span>
      )}
    </div>
  );
}