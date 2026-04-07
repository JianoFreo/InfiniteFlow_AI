const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function normalizeOutputUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function createJob(file: File, interpolationFactor: number) {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE}/api/v1/jobs?interpolation_factor=${interpolationFactor}`;
  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error("Failed to create job");
  }
  return res.json() as Promise<{ id: string; status: string }>;
}

export async function getJob(id: string) {
  const res = await fetch(`${API_BASE}/api/v1/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch job");
  }
  const data = (await res.json()) as {
    id: string;
    status: string;
    interpolation_factor: number;
    progress: number;
    error_message?: string;
    output_ready: boolean;
    output_url?: string;
    created_at: string;
  };
  return {
    ...data,
    output_url: normalizeOutputUrl(data.output_url),
  };
}

export async function cancelJob(id: string) {
  const res = await fetch(`${API_BASE}/api/v1/jobs/${id}/cancel`, { method: "POST" });
  if (!res.ok) {
    throw new Error("Failed to cancel job");
  }
  const data = (await res.json()) as {
    id: string;
    status: string;
    interpolation_factor: number;
    progress: number;
    error_message?: string;
    output_ready: boolean;
    output_url?: string;
    created_at: string;
  };
  return {
    ...data,
    output_url: normalizeOutputUrl(data.output_url),
  };
}
