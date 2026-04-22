export type AiMapQueryAuditEntry = {
  userId: string;
  promptSnippet: string;
  sqlSnippet: string;
  ok: boolean;
  durationMs: number;
  rowCount: number;
  truncated?: boolean;
  error?: string;
};

const MAX_SNIP = 800;

function snip(s: string, max = MAX_SNIP): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Server-side audit trail (no PII beyond user id). */
export function logAiMapQueryAudit(entry: AiMapQueryAuditEntry): void {
  console.info(
    "[ai-map-query]",
    JSON.stringify({
      userId: entry.userId,
      promptSnippet: snip(entry.promptSnippet),
      sqlSnippet: snip(entry.sqlSnippet),
      ok: entry.ok,
      durationMs: entry.durationMs,
      rowCount: entry.rowCount,
      truncated: entry.truncated,
      error: entry.error ? snip(entry.error, 400) : undefined,
    })
  );
}
