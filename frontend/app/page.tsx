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
    <main>
      <div className="panel">
        <h1>InfiniteFlow Interpolator</h1>
        <p>Upload MP4 and generate smoother playback using lightweight frame blending.</p>

        <form onSubmit={onSubmit}>
          <label htmlFor="file">Video File</label>
          <input
            id="file"
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <label htmlFor="factor">Interpolation Factor</label>
          <select
            id="factor"
            value={factor}
            onChange={(e) => setFactor(Number(e.target.value))}
          >
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Queueing..." : "Create Job"}
          </button>
        </form>

        {error ? <div className="result">{error}</div> : null}

        {jobId ? (
          <div className="result">
            Job created: <strong>{jobId}</strong>
            <br />
            <Link href={`/jobs/${jobId}`}>Open job status</Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
