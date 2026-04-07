"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getJob } from "../../../lib/api";

type JobData = {
  id: string;
  status: string;
  interpolation_factor: number;
  progress: number;
  error_message?: string;
  output_ready: boolean;
  output_url?: string;
  created_at: string;
};

function statusTone(status?: string): string {
  if (status === "completed") return "text-emerald-700";
  if (status === "failed") return "text-red-700";
  if (status === "processing") return "text-amber-700";
  return "text-slate-700";
}

export default function JobPage() {
  const params = useParams<{ id: string }>();
  const id = useMemo(() => params?.id, [params]);
  const [job, setJob] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    const poll = async () => {
      try {
        const data = await getJob(id);
        if (!mounted) return;
        setJob(data);
        setError(null);

        if (data.status === "queued" || data.status === "processing") {
          timer = setTimeout(poll, 2500);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to fetch job");
      }
    };

    poll();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  const progress = Math.max(0, Math.min(100, job?.progress ?? 0));

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-panel sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Processing Status</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">Polling every 2.5 seconds while queued or processing.</p>

        <div className="mt-5 space-y-2 text-sm text-slate-700">
          <p>Job ID: <span className="font-semibold">{id}</span></p>
          <p>
            Status: <span className={`font-semibold ${statusTone(job?.status)}`}>{job?.status ?? "loading"}</span>
          </p>
          <p>Factor: {job?.interpolation_factor ?? "-"}x</p>
          <p>Created: {job ? new Date(job.created_at).toLocaleString() : "-"}</p>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-moss transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {job?.error_message ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error: {job.error_message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {job?.output_ready && job.output_url ? (
          <a
            href={job.output_url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Download Result
          </a>
        ) : null}

        <div className="mt-5">
          <Link href="/" className="text-sm font-semibold text-moss underline underline-offset-4">
            Back to upload
          </Link>
        </div>
      </section>
    </main>
  );
}
