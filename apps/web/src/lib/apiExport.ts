import type { RunJson } from "@rcc/shared";

const API_BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: { error?: string; message?: string } = {};
    try {
      body = await res.json();
    } catch {}
    throw new Error(body.message || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface ExportResponse {
  run: RunJson;
  path: string;
  bytes: number;
}

export const exportApi = {
  markdown: (runId: string) =>
    req<ExportResponse>(`/runs/${encodeURIComponent(runId)}/export/markdown`, {
      method: "POST",
      body: "{}",
    }),
  zip: (runId: string) =>
    req<ExportResponse>(`/runs/${encodeURIComponent(runId)}/export/zip`, {
      method: "POST",
      body: "{}",
    }),
  pdf: (runId: string) =>
    req<ExportResponse>(`/runs/${encodeURIComponent(runId)}/export/pdf`, {
      method: "POST",
      body: "{}",
    }),
  openFolder: (runId: string) =>
    req<{ run: RunJson; opened: string }>(
      `/runs/${encodeURIComponent(runId)}/open-folder`,
      { method: "POST", body: "{}" },
    ),
};
