
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Briefcase,
  Radar,
  ArrowUpRight,
  UploadCloud,
  Plus,
  Sparkles,
  FileSearch,
  ChevronRight,
} from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { resumesApi, jobsApi, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  JobDescriptionResponse,
  ResumeListItem,
} from "@/lib/types";

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
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not load the dashboard."
          );
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
        subtitle="Your AI-powered candidate screening workspace."
      />

      <div className="space-y-7 px-5 py-6 md:px-8">
        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Welcome / hero */}
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-7">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/10 text-signal">
                  <Sparkles className="h-4 w-4" />
                </span>

                <span className="eyebrow">
                  AI Resume Matcher
                </span>
              </div>

              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                Find the right candidates faster.
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-ink-500">
                Upload resumes, create job roles, and use AI-powered
                matching to understand which candidates fit your
                requirements.
              </p>
            </div>

            <Link
              to="/search"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Radar className="h-4 w-4" />
              Start matching
            </Link>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Candidates"
            value={resumeCount}
            href="/resumes"
            description="Resumes in your candidate pool"
          />

          <StatCard
            icon={<Briefcase className="h-4 w-4" />}
            label="Open roles"
            value={jobCount}
            href="/jobs"
            description="Saved roles ready for matching"
          />

          <Link
            to="/search"
            className="card group flex min-h-[148px] flex-col justify-between p-5 transition-shadow hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">AI matching</span>

              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/10 text-signal">
                <Radar className="h-4 w-4" />
              </span>
            </div>

            <div>
              <p className="font-display text-lg font-semibold text-ink">
                Rank candidates by fit
              </p>

              <div className="mt-2 flex items-center gap-1 text-xs font-medium text-signal">
                Run a match
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        </div>

        {/* Quick actions */}
        <section>
          <div className="mb-3">
            <p className="eyebrow">Quick actions</p>
            <p className="mt-1 text-sm text-ink-500">
              Continue building your candidate pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickAction
              href="/resumes"
              icon={<UploadCloud className="h-4 w-4" />}
              title="Upload resumes"
              description="Add candidates to your pool"
            />

            <QuickAction
              href="/jobs"
              icon={<Plus className="h-4 w-4" />}
              title="Create a role"
              description="Define a job and required skills"
            />

            <QuickAction
              href="/search"
              icon={<Radar className="h-4 w-4" />}
              title="Match candidates"
              description="Compare candidates against a role"
            />
          </div>
        </section>

        {/* Recent activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel
            title="Recent candidates"
            subtitle="Latest resumes added to the system"
            viewAllHref="/resumes"
          >
            {recentResumes.length === 0 ? (
              <UploadPrompt />
            ) : (
              <ul className="mt-3 divide-y divide-line-subtle">
                {recentResumes.map((resume) => (
                  <li key={resume.id}>
                    <Link
                      to={`/resumes/${resume.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ink/[0.025]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-100 text-ink-500">
                          <FileSearch className="h-4 w-4" />
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {resume.candidate_name}
                          </p>

                          <p className="mt-0.5 text-xs text-ink-400">
                            {resume.skills?.length ?? 0} skills identified
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-ink-300">
                          {formatDate(resume.created_at)}
                        </span>

                        <ChevronRight className="h-3.5 w-3.5 text-ink-300 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent roles"
            subtitle="Latest job descriptions added"
            viewAllHref="/jobs"
          >
            {recentJobs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-500">
                Create a role to start matching candidates against it.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line-subtle">
                {recentJobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ink/[0.025]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-100 text-ink-500">
                          <Briefcase className="h-4 w-4" />
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {job.title}
                          </p>

                          <p className="mt-0.5 text-xs text-ink-400">
                            {job.required_skills?.length ?? 0} required skills
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-ink-300">
                          {formatDate(job.created_at)}
                        </span>

                        <ChevronRight className="h-3.5 w-3.5 text-ink-300 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* How it works */}
        <section className="card p-5 md:p-6">
          <div className="mb-5">
            <p className="eyebrow">How it works</p>

            <h2 className="mt-1 font-display text-lg font-semibold text-ink">
              From resume to ranked candidate
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              A simple workflow for intelligent candidate screening.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <WorkflowStep
              number="01"
              title="Upload resumes"
              description="The system extracts and structures candidate information from uploaded resumes."
            />

            <WorkflowStep
              number="02"
              title="Define requirements"
              description="Create a role with its description and required technical skills."
            />

            <WorkflowStep
              number="03"
              title="Match & understand"
              description="AI combines semantic similarity and skill matching to rank candidates and show skill gaps."
            />
          </div>
        </section>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: number | null;
  href: string;
  description: string;
}) {
  return (
    <Link
      to={href}
      className="card group flex min-h-[148px] flex-col justify-between p-5 transition-shadow hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>

        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-100 text-ink-400 transition-colors group-hover:text-signal">
          {icon}
        </span>
      </div>

      <div>
        {value === null ? (
          <Skeleton className="mt-3 h-9 w-16" />
        ) : (
          <p className="flex items-center gap-1.5 font-display text-3xl font-semibold text-ink">
            {value}
            <ArrowUpRight className="h-4 w-4 text-ink-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </p>
        )}

        <p className="mt-1 text-xs text-ink-400">
          {description}
        </p>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 transition-all hover:border-signal/30 hover:shadow-sm"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-100 text-ink-500 transition-colors group-hover:bg-signal/10 group-hover:text-signal">
        {icon}
      </span>

      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {title}
        </p>

        <p className="mt-0.5 truncate text-xs text-ink-400">
          {description}
        </p>
      </div>

      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Panel({
  title,
  subtitle,
  viewAllHref,
  children,
}: {
  title: string;
  subtitle: string;
  viewAllHref: string;
  children: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-ink">
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-ink-400">
            {subtitle}
          </p>
        </div>

        <Link
          to={viewAllHref}
          className="shrink-0 text-xs font-medium text-signal hover:text-signal-600"
        >
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
      className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-line px-3 py-6 text-sm text-ink-500 transition-colors hover:border-signal hover:text-signal"
    >
      <UploadCloud className="h-4 w-4" />
      Upload your first resume
    </Link>
  );
}

function WorkflowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border border-line-subtle bg-paper-100 p-4">
      <span className="font-mono text-[10px] font-semibold tracking-wider text-signal">
        {number}
      </span>

      <h3 className="mt-3 text-sm font-semibold text-ink">
        {title}
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-ink-500">
        {description}
      </p>
    </div>
  );
}
