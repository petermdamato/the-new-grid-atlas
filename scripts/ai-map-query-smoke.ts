/**
 * Minimal checks for AI map query: SQL validation rules + DuckDB WASM init + two queries.
 * Run: npm run test:ai-map-smoke
 */
import assert from "node:assert/strict";
import { createAiMapDuckDbContext, runDuckDbAll } from "@/lib/ai-map-query/load-duckdb";
import { validateAiMapSql, validateStringAggSeparators } from "@/lib/ai-map-query/validate-sql";

async function main() {
  assert.equal(validateStringAggSeparators("SELECT string_agg(code, ',') FROM warehouses"), null);
  assert.ok(
    validateStringAggSeparators("SELECT string_agg(code, delim) FROM warehouses"),
    "non-literal separator should fail"
  );

  let r = validateAiMapSql("SELECT string_agg(code, sep) FROM warehouses");
  assert.equal(r.ok, false);

  r = validateAiMapSql("SELECT string_agg(code, ', ') FROM warehouses");
  assert.equal(r.ok, true);

  r = validateAiMapSql("SELECT code FROM warehouses LIMIT 1");
  assert.equal(r.ok, true);

  r = validateAiMapSql("SELECT group_concat(code) FROM warehouses");
  assert.equal(r.ok, false);

  r = validateAiMapSql("SELECT ifnull(code, '') FROM warehouses");
  assert.equal(r.ok, false);

  const ctx = await createAiMapDuckDbContext();
  try {
    const rows = await runDuckDbAll(ctx.conn, "SELECT substring_index('a.b.c', '.', 2) AS v");
    assert.equal(String(rows[0]?.v), "a.b");

    const rows2 = await runDuckDbAll(
      ctx.conn,
      "SELECT string_agg(x, ',') AS v FROM (VALUES ('x'), ('y')) AS t(x)"
    );
    assert.equal(String(rows2[0]?.v), "x,y");
  } finally {
    ctx.close();
  }

  console.log("ai-map-query-smoke: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
