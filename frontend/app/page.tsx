"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { createJob } from "../lib/api";

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [factor, setFactor] = useState(2);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    </main>
  );
}
