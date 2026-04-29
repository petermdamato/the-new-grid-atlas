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

/** Index of `)` that closes the `(` at `openParenIdx` (depth 0), or -1. Respects `'...'` with `''` escapes. */
function indexOfClosingParen(sql: string, openParenIdx: number): number {
  let depth = 0;
  let inSingle = false;
  for (let i = openParenIdx; i < sql.length; i++) {
    const c = sql[i]!;
    if (inSingle) {
      if (c === "'" && sql[i + 1] === "'") {
        i++;
        continue;
      }
      if (c === "'") inSingle = false;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * DuckDB requires `string_agg(expr, sep)`'s separator to be a compile-time string literal.
 * Optional `ORDER BY` after the literal is allowed (DuckDB aggregate form).
 */
export function validateStringAggSeparators(sql: string): string | null {
  const re = /\bstring_agg\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const openParen = m.index + m[0].length - 1;
    if (sql[openParen] !== "(") continue;
    const closeParen = indexOfClosingParen(sql, openParen);
    if (closeParen < 0) {
      return "Unbalanced parentheses in string_agg(...) — check generated SQL.";
    }
    const inner = sql.slice(openParen + 1, closeParen);
    const commaIdx = indexOfFirstCommaAtDepthZero(inner);
    if (commaIdx < 0) {
      return "string_agg(...) must have two arguments: expression and a string-literal separator.";
    }
    const rest = inner.slice(commaIdx + 1).trim();
    const literalOrder = /^\s*('(?:[^']|'')*')\s*(ORDER\s+BY\b[\s\S]*)?$/i.exec(rest);
    if (!literalOrder) {
      return (
        "string_agg separator must be a string literal (e.g. ', '). DuckDB does not accept a column or expression as the separator " +
        '(Binder Error: Separator argument to StringAgg must be a constant).'
      );
    }
  }
  return null;
}

/** First `,` not inside `()` or `'...'`, for substring starting at aggregate args. */
function indexOfFirstCommaAtDepthZero(s: string): number {
  let depth = 0;
  let inSingle = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inSingle) {
      if (c === "'" && s[i + 1] === "'") {
        i++;
        continue;
      }
      if (c === "'") inSingle = false;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return i;
  }
  return -1;
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

  if (/\bgroup_concat\s*\(/i.test(sql)) {
    return {
      ok: false,
      error: "MySQL GROUP_CONCAT is not available; use string_agg(expr, ', ') with a string-literal separator, or list(expr) with array_to_string.",
    };
  }
  if (/\bifnull\s*\(/i.test(sql)) {
    return { ok: false, error: "Use coalesce(a, b) instead of MySQL ifnull(a, b)." };
  }

  const aggSepErr = validateStringAggSeparators(sql);
  if (aggSepErr) return { ok: false, error: aggSepErr };

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
