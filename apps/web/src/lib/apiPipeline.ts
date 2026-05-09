import type {
  PipelineStage,
  RerunStageRequest,
  RunEvent,
  RunJson,
  StageState,
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

export interface StageRunResponse {
  run: RunJson;
  stage: StageState;
  content: string;
}

export interface StartPipelineResponse {
  ok: true;
  run: RunJson;
  running: true;
}

export const pipelineApi = {
  runStage: (
    runId: string,
    stage: PipelineStage,
    body: RerunStageRequest = {},
  ) =>
    req<StageRunResponse>(
      `/runs/${encodeURIComponent(runId)}/pipeline/stages/${encodeURIComponent(stage)}/run`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  startReview: (runId: string, body?: { fromStage?: PipelineStage }) =>
    req<StartPipelineResponse>(
      `/runs/${encodeURIComponent(runId)}/pipeline/run`,
      { method: "POST", body: JSON.stringify(body ?? {}) },
    ),
  cancel: (runId: string) =>
    req<{ ok: true }>(`/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      body: "{}",
    }),
  fileContent: (runId: string, relPath: string) =>
    req<{ path: string; content: string }>(
      `/runs/${encodeURIComponent(runId)}/files/content?path=${encodeURIComponent(relPath)}`,
    ),
};

export function openEventStream(
  runId: string,
  onEvent: (e: RunEvent) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/runs/${encodeURIComponent(runId)}/events`);
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as RunEvent);
    } catch {
      // Ignore malformed messages.
    }
  };
  es.onerror = () => {
    // Browser auto-reconnects; nothing to do here.
  };
  return () => es.close();
}
