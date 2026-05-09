import type { EnrichRequest, RunJson, StageState } from "@rcc/shared";

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

export interface EnrichGetResponse {
  enrichedPrompt: string | null;
  modelInstructions: string | null;
  run: RunJson;
}

export interface EnrichPostResponse {
  enrichedPrompt: string;
  modelInstructions: string;
  stage: StageState;
  run: RunJson;
}

export const enrichApi = {
  get: (runId: string) =>
    req<EnrichGetResponse>(`/runs/${encodeURIComponent(runId)}/enrich`),
  trigger: (runId: string, body: EnrichRequest) =>
    req<EnrichPostResponse>(`/runs/${encodeURIComponent(runId)}/enrich`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
