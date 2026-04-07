"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { cancelJob, createJob, listJobs, type JobItem } from "../lib/api";

function statusLabel(job: JobItem): string {
  if (job.status === "failed" && (job.error_message || "").startsWith("Cancelled by user")) return "cancelled";
  return job.status;
}

function statusDescription(label: string): string {
  if (label === "queued") return "Waiting in queue";
  if (label === "processing") return "Worker is processing";
  if (label === "completed") return "Ready for download";
  if (label === "cancelled") return "Cancelled by user";
  if (label === "failed") return "Processing failed";
  return label;
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [factor, setFactor] = useState(2);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const visibleJobs = useMemo(() => jobs.slice(0, 20), [jobs]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let mounted = true;

    const poll = async () => {
      try {
        const rows = await listJobs(false, 50);
        if (!mounted) return;
        setJobs(rows);
        setQueueError(null);
      } catch (err) {
        if (!mounted) return;
        setQueueError(err instanceof Error ? err.message : "Failed to load queue");
      } finally {
        if (mounted) timer = setTimeout(poll, 2500);
      }
    };

    poll();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function onCancel(id: string) {
    setCancelingId(id);
    try {
      await cancelJob(id);
      const rows = await listJobs(false, 50);
      setJobs(rows);
      setQueueError(null);
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setCancelingId(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Please choose an input video.");
      return;
    }

    setLoading(true);
    setError(null);
    setJobId(null);

    try {
      const res = await createJob(file, factor);
      setJobId(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-panel sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Video Interpolation</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Upload a source video, track progress, and download the processed result.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="file" className="mb-2 block text-sm font-semibold text-slate-700">
              Video file
            </label>
            <input
              id="file"
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
            />
          </div>

          <div>
            <label htmlFor="factor" className="mb-2 block text-sm font-semibold text-slate-700">
              Interpolation factor
            </label>
            <select
              id="factor"
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value))}
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-moss px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Queueing..." : "Upload and process"}
          </button>
        </form>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {jobId ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p>
              Job queued: <span className="font-semibold">{jobId}</span>
            </p>
            <Link href={`/jobs/${jobId}`} className="mt-2 inline-block font-semibold text-moss underline underline-offset-4">
              View processing status
            </Link>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-panel sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Queue Manager</h2>
          <span className="text-xs text-slate-500">Auto refresh: 2.5s</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">View all recent jobs, cancel queued/processing jobs, and jump to download or details.</p>

        {queueError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{queueError}</div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Job</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Progress</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Created</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {visibleJobs.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>No jobs yet.</td>
                </tr>
              ) : (
                visibleJobs.map((job) => {
                  const label = statusLabel(job);
                  const canCancel = label === "queued" || label === "processing";
                  return (
                    <tr key={job.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800">{job.id.slice(0, 8)}...</div>
                        <div className="text-xs text-slate-500">{job.interpolation_factor}x</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{statusDescription(label)}</td>
                      <td className="px-3 py-3 text-slate-700">{job.progress}%</td>
                      <td className="px-3 py-3 text-slate-600">{new Date(job.created_at).toLocaleTimeString()}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/jobs/${job.id}`} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            Open
                          </Link>
                          {job.output_ready && job.output_url ? (
                            <a href={job.output_url} target="_blank" rel="noreferrer" className="rounded-md bg-moss px-2.5 py-1 text-xs font-semibold text-white hover:brightness-95">
                              Download
                            </a>
                          ) : null}
                          {canCancel ? (
                            <button
                              type="button"
                              disabled={cancelingId === job.id}
                              onClick={() => onCancel(job.id)}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {cancelingId === job.id ? "..." : "Cancel"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
