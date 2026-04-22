import { Parser } from "node-sql-parser";
import { AI_MAP_QUERY_ALLOWED_TABLES } from "./schema";

const FORBIDDEN = new Set(
  [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "REPLACE",
    "MERGE",
    "GRANT",
    "REVOKE",
    "COPY",
    "ATTACH",
    "DETACH",
    "INSTALL",
    "LOAD",
    "PRAGMA",
    "CALL",
    "EXECUTE",
    "VACUUM",
    "EXPORT",
    "IMPORT",
  ].map((s) => s.toUpperCase())
);

const parser = new Parser();

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim();
}

/** node-sql-parser `tableList` entries look like `select::null::warehouses`. */
function tableNamesFromTableList(tableList: string[]): string[] {
  const out = new Set<string>();
  for (const entry of tableList) {
    const parts = entry.split("::");
    const name = parts[parts.length - 1]?.replace(/^"|"$/g, "").toLowerCase();
    if (name) out.add(name);
  }
  return [...out];
}

/**
 * Validates model-generated SQL: single SELECT (UNION allowed), no forbidden DDL/DML tokens,
 * no WITH (CTE names break allowlisting), referenced base tables ⊆ allowlist.
 */
export function validateAiMapSql(rawSql: string): { ok: true; sql: string } | { ok: false; error: string } {
  const sql = stripSqlComments(rawSql).replace(/;+\s*$/g, "").trim();
  if (!sql) return { ok: false, error: "Empty SQL" };

  const upper = sql.toUpperCase();
  if (/\bWITH\b/.test(upper)) {
    return { ok: false, error: "WITH / CTE queries are not allowed; use a single SELECT from the allowlisted tables." };
  }

  for (const word of FORBIDDEN) {
    if (upper.includes(word)) {
      return { ok: false, error: `Disallowed statement or keyword: ${word}` };
    }
  }

  if (!upper.startsWith("SELECT")) {
    return { ok: false, error: "Only SELECT is allowed" };
  }

  let parseResult: ReturnType<typeof parser.parse>;
  try {
    parseResult = parser.parse(sql, { database: "postgresql" });
  } catch (e) {
    return { ok: false, error: `SQL parse error: ${e instanceof Error ? e.message : String(e)}` };
  }

  const roots = Array.isArray(parseResult.ast) ? parseResult.ast : [parseResult.ast];
  if (roots.length !== 1) {
    return { ok: false, error: "Only one SQL statement is allowed" };
  }

  const root = roots[0] as unknown as { type?: string };
  const type = String(root.type || "").toLowerCase();
  if (type !== "select") {
    return { ok: false, error: `Expected SELECT, got ${type || "unknown"}` };
  }

  const tables = tableNamesFromTableList(parseResult.tableList || []);
  const allowed = new Set(AI_MAP_QUERY_ALLOWED_TABLES.map((t) => t.toLowerCase()));
  for (const t of tables) {
    if (!allowed.has(t)) {
      return { ok: false, error: `Table not allowed: ${t}` };
    }
  }

  return { ok: true, sql };
}

/** Wrap validated inner SELECT with a hard row cap (may return cap+1 rows to detect truncation). */
export function wrapSqlWithOuterLimit(innerSql: string, cap: number): string {
  const safeCap = Math.min(Math.max(1, Math.floor(cap)), 500);
  return `SELECT * FROM (${innerSql}) AS _ai_subq LIMIT ${safeCap + 1}`;
}
