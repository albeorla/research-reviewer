import type {
  RunJson,
  SaveSourceRequest,
  SourceName,
  SourceState,
} from "@rcc/shared";

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

export interface SourceContent {
  state: SourceState;
  content: string | null;
}

export interface SourcesListResponse {
  run: RunJson;
  sources: Record<SourceName, SourceContent>;
}

export interface SaveSourceResponse {
  run: RunJson;
  sourceState: SourceState;
  content: string;
}

export const sourcesApi = {
  list: (runId: string) =>
    req<SourcesListResponse>(`/runs/${encodeURIComponent(runId)}/sources`),
  save: (runId: string, name: SourceName, body: SaveSourceRequest) =>
    req<SaveSourceResponse>(
      `/runs/${encodeURIComponent(runId)}/sources/${encodeURIComponent(name)}`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  setEnabled: (runId: string, name: SourceName, enabled: boolean) =>
    req<SourcesListResponse>(
      `/runs/${encodeURIComponent(runId)}/sources/${encodeURIComponent(name)}/enabled`,
      { method: "POST", body: JSON.stringify({ enabled }) },
    ),
};
