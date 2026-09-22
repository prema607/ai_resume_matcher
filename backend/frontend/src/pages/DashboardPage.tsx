import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Users, Briefcase, Radar, ArrowUpRight, UploadCloud } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { resumesApi, jobsApi, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import type { JobDescriptionResponse, ResumeListItem } from "@/lib/types";

export function DashboardPage() {
  const [resumeCount, setResumeCount] = useState<number | null>(null);
  const [jobCount, setJobCount] = useState<number | null>(null);
  const [recentResumes, setRecentResumes] = useState<ResumeListItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<JobDescriptionResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [resumes, jobs] = await Promise.all([
          resumesApi.list({ limit: 5 }),
          jobsApi.list({ limit: 5 }),
        ]);
        if (cancelled) return;
        setResumeCount(resumes.total);
        setJobCount(jobs.total);
        setRecentResumes(resumes.items);
        setRecentJobs(jobs.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load the dashboard.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TopBar
        title="Overview"
        subtitle="Everything currently in the candidate pool and open roles."
      />
      <div className="space-y-6 px-5 py-6 md:px-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Candidates"
            value={resumeCount}
            href="/resumes"
          />
          <StatCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Open roles"
            value={jobCount}
            href="/jobs"
          />
          <Link
            to="/search"
            className="card flex flex-col justify-between p-5 transition-shadow hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">Run a match</span>
              <Radar className="h-4 w-4 text-signal" />
            </div>
            <p className="mt-3 font-display text-lg font-semibold text-ink">
              Rank candidates by fit
            </p>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel
            title="Recent candidates"
            emptyLabel="No resumes uploaded yet."
            viewAllHref="/resumes"
          >
            {recentResumes.length === 0 ? (
              <UploadPrompt />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {recentResumes.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/resumes/${r.id}`}
                      className="flex items-center justify-between px-1 py-3 text-sm hover:bg-ink/[0.02]"
                    >
                      <span className="font-medium text-ink">{r.candidate_name}</span>
                      <span className="font-mono text-xs text-ink-300">
                        {formatDate(r.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent roles" emptyLabel="No roles posted yet." viewAllHref="/jobs">
            {recentJobs.length === 0 ? (
              <p className="px-1 py-8 text-center text-sm text-ink-500">
                Post a role to start ranking candidates against it.
              </p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {recentJobs.map((j) => (
                  <li key={j.id}>
                    <Link
                      to={`/jobs/${j.id}`}
                      className="flex items-center justify-between px-1 py-3 text-sm hover:bg-ink/[0.02]"
                    >
                      <span className="font-medium text-ink">{j.title}</span>
                      <span className="font-mono text-xs text-ink-300">
                        {formatDate(j.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: number | null;
  href: string;
}) {
  return (
    <Link to={href} className="card flex flex-col justify-between p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="text-ink-300">{icon}</span>
      </div>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 flex items-baseline gap-1.5 font-display text-3xl font-semibold text-ink">
          {value}
          <ArrowUpRight className="h-4 w-4 text-ink-300" />
        </p>
      )}
    </Link>
  );
}

function Panel({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  emptyLabel: string;
  viewAllHref: string;
  children: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
        <Link to={viewAllHref} className="text-xs font-medium text-signal hover:text-signal-600">
          View all
        </Link>
      </div>
      {children}
    </div>
  );
}

function UploadPrompt() {
  return (
    <Link
      to="/resumes"
      className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-6 text-sm text-ink-500 hover:border-signal hover:text-signal"
    >
      <UploadCloud className="h-4 w-4" /> Upload your first resume
    </Link>
  );
}
