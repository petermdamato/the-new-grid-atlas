import { createRequire } from "node:module";
import type { DuckDBConnection } from "@duckdb/duckdb-wasm/blocking";
import type * as NodeBlocking from "../../../node_modules/@duckdb/duckdb-wasm/dist/types/src/targets/duckdb-node-blocking";

const require = createRequire(import.meta.url);
const blocking = require("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs") as typeof NodeBlocking;

export const createDuckDB = blocking.createDuckDB;
export const DuckDBAccessMode = blocking.DuckDBAccessMode;
export const NODE_RUNTIME = blocking.NODE_RUNTIME;
export const VoidLogger = blocking.VoidLogger;
export type { DuckDBConnection };
