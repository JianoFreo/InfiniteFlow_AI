const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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
  return res.json() as Promise<{
    id: string;
    status: string;
    interpolation_factor: number;
    progress: number;
    error_message?: string;
    output_ready: boolean;
    output_url?: string;
    created_at: string;
  }>;
}
