export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "bad_request", message, details);

export const notFound = (message: string) =>
  new HttpError(404, "not_found", message);

export const conflict = (message: string) =>
  new HttpError(409, "conflict", message);

export const internal = (message: string) =>
  new HttpError(500, "internal_error", message);
