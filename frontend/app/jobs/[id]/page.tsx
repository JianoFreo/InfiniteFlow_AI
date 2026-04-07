"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getJob } from "../../../lib/api";

type JobData = {
  id: string;
  status: string;
  interpolation_factor: number;
  error_message?: string;
  output_ready: boolean;
  output_url?: string;
  created_at: string;
};

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

  return (
    <main>
      <div className="panel">
        <h1>Job Status</h1>
        <p>Track processing and download output when ready.</p>

        <div className="result" style={{ marginTop: 16 }}>
          <div>Job ID: {id}</div>
          <div>Status: {job?.status ?? "loading"}</div>
          <div>Factor: {job?.interpolation_factor ?? "-"}</div>
          <div>Created: {job ? new Date(job.created_at).toLocaleString() : "-"}</div>
        </div>

        {job?.error_message ? <div className="result">Error: {job.error_message}</div> : null}
        {error ? <div className="result">{error}</div> : null}

        {job?.output_ready && job.output_url ? (
          <div className="result">
            <a href={job.output_url} target="_blank" rel="noreferrer">
              Download output video
            </a>
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <Link href="/">Back to upload</Link>
        </div>
      </div>
    </main>
  );
}
