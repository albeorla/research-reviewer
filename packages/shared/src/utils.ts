/**
 * Normalize a freeform topic into a filesystem-safe slug.
 * Lowercase, hyphen-separated, alphanumeric only, max 80 chars.
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function isValidSlug(input: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,79})$/.test(input);
}

export function todayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Rough heuristic — close enough for UI display, not for billing.
export function approxTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function runFolderName(slug: string, date: string): string {
  return `${slug}-${date}`;
}
