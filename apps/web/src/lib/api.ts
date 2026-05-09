import type {
  CreateRunRequest,
  RunJson,
  RunSummary,
  UpdateRunRequest,
} from "@rcc/shared";

const API_BASE = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: { error?: string; message?: string; details?: unknown } = {};
    try {
      body = await res.json();
    } catch {
      // Fall through; we'll synthesize from status text.
    }
    throw new ApiError(
      res.status,
      body.error ?? "request_failed",
      body.message ?? `${res.status} ${res.statusText}`,
      body.details,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  defaultOutputRoot: string;
  nodeVersion: string;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  listRuns: (limit = 20) =>
    request<{ runs: RunSummary[] }>(`/runs?limit=${limit}`),
  getRun: (id: string) => request<RunJson>(`/runs/${encodeURIComponent(id)}`),
  createRun: (body: CreateRunRequest) =>
    request<RunJson>("/runs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRun: (id: string, body: UpdateRunRequest) =>
    request<RunJson>(`/runs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
