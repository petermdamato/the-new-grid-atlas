import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSqlFromNaturalLanguage } from "@/lib/ai-map-query/generate-sql";
import { validateAiMapSql, wrapSqlWithOuterLimit } from "@/lib/ai-map-query/validate-sql";
import {
  createAiMapDuckDbContext,
  runDuckDbAll,
  aiQueryRowsToFeatureCollection,
} from "@/lib/ai-map-query/load-duckdb";
import { filterHeldOutTypesFromAiMapGeojson } from "@/lib/ai-map-query/hold-out-from-ai-map";
import { logAiMapQueryAudit } from "@/lib/ai-map-query/audit";

export const runtime = "nodejs";
/** Serverless platforms (e.g. Vercel): allow LLM + DuckDB enough wall time */
export const maxDuration = 60;

const OUTER_CAP = 500;
const TIMEOUT_MS = 25_000;

/** Include generated SQL in JSON so the browser can log it (dev or AI_MAP_QUERY_LOG_SQL=1). */
function exposeSqlToClient(): boolean {
  return process.env.NODE_ENV === "development" || process.env.AI_MAP_QUERY_LOG_SQL === "1";
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let userId = "";
  let promptText = "";
  let sqlForAudit = "";

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required to run AI map queries." }, { status: 401 });
    }
    userId = user.id;

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: "AI map query is not configured (missing OPENAI_API_KEY)." }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const query =
      typeof body === "object" && body !== null && "query" in body && typeof (body as { query: unknown }).query === "string"
        ? (body as { query: string }).query.trim()
        : "";

    if (!query || query.length > 2000) {
      return NextResponse.json({ error: "Provide a non-empty query (max 2000 characters)." }, { status: 400 });
    }
    promptText = query;

    const rawSql = await withTimeout(generateSqlFromNaturalLanguage(query), TIMEOUT_MS, "LLM");
    sqlForAudit = rawSql;

    const validated = validateAiMapSql(rawSql);
    if (!validated.ok) {
      logAiMapQueryAudit({
        userId,
        promptSnippet: promptText,
        sqlSnippet: sqlForAudit,
        ok: false,
        durationMs: Date.now() - t0,
        rowCount: 0,
        error: validated.error,
      });
      return NextResponse.json(
        exposeSqlToClient()
          ? { error: validated.error, debugSql: sqlForAudit }
          : { error: validated.error },
        { status: 400 }
      );
    }

    const wrapped = wrapSqlWithOuterLimit(validated.sql, OUTER_CAP);
    console.log(`[ai-map-query] validated SQL:\n${validated.sql}`);
    console.log(`[ai-map-query] executed SQL (outer limit wrapper):\n${wrapped}`);

    const ctx = await createAiMapDuckDbContext();
    try {
      const rows = await withTimeout(runDuckDbAll(ctx.conn, wrapped), TIMEOUT_MS, "DuckDB");
      const truncated = rows.length > OUTER_CAP;
      const trimmed = truncated ? rows.slice(0, OUTER_CAP) : rows;
      const geojson = filterHeldOutTypesFromAiMapGeojson(aiQueryRowsToFeatureCollection(trimmed));

      logAiMapQueryAudit({
        userId,
        promptSnippet: promptText,
        sqlSnippet: validated.sql,
        ok: true,
        durationMs: Date.now() - t0,
        rowCount: geojson.features.length,
        truncated,
      });

      const payload: Record<string, unknown> = {
        geojson,
        truncated,
        rowCount: geojson.features.length,
      };
      if (exposeSqlToClient()) {
        payload.debugSql = validated.sql;
        payload.debugWrappedSql = wrapped;
      }
      return NextResponse.json(payload);
    } finally {
      ctx.close();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logAiMapQueryAudit({
      userId: userId || "unknown",
      promptSnippet: promptText,
      sqlSnippet: sqlForAudit,
      ok: false,
      durationMs: Date.now() - t0,
      rowCount: 0,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
