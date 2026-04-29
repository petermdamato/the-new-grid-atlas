import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AI_MAP_QUERY_SCHEMA_DOC } from "./schema";

const SYSTEM_PREFIX = `You are a DuckDB SQL generator for a read-only analytics database.
Output exactly one SELECT statement. No comments. No semicolons. No WITH/CTE clauses.
Return ONLY the raw SQL text — no markdown fences, no explanation.
The database is DuckDB (embedded), not MySQL. Prefer DuckDB idioms: coalesce (not ifnull); \`string_agg(expr, ', ')\` for MySQL GROUP_CONCAT only when the separator is a **string literal** (DuckDB rejects a non-constant separator); otherwise use \`list(expr)\` with \`array_to_string\` using a literal delimiter, or \`concat_ws\` with literals; split_part / string_split / strpos for strings.

`;

export function extractSqlFromLlmOutput(text: string): string {
  let t = text.trim();
  const multilineFence = /^```(?:sql)?\s*\n([\s\S]*?)\n```\s*$/i.exec(t);
  if (multilineFence) {
    t = multilineFence[1]!.trim();
  } else {
    t = t.replace(/^```sql\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return t.replace(/;+\s*$/g, "").trim();
}

export async function generateSqlFromNaturalLanguage(userQuery: string): Promise<string> {
  const model = process.env.AI_MAP_QUERY_MODEL?.trim() || "gpt-4o-mini";
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const llm = new ChatOpenAI({
    model,
    temperature: 0,
    apiKey,
  });

  const res = await llm.invoke([
    new SystemMessage(`${SYSTEM_PREFIX}${AI_MAP_QUERY_SCHEMA_DOC}`),
    new HumanMessage(userQuery),
  ]);

  const content = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
  return extractSqlFromLlmOutput(content);
}
