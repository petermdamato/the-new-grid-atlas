-- =============================================================================
-- Update public.data_center_confirmations from output_for_confirmation.csv
-- =============================================================================
-- Prefer: **update_data_center_confirmations_from_csv_inline.sql** — full paste-ready
-- UPDATE built from the CSV (no import step).
--
-- Postgres / Supabase cannot read your Next.js public/output_for_confirmation.csv
-- file directly. You must load the CSV into a staging table first, then run the
-- UPDATE below.
--
-- Option A — Supabase Dashboard: create the staging table (section 1), then
--   Table Editor → New table or use SQL → Import the CSV into _stg_dc_confirm_csv.
--
-- Option B — psql from your machine (path to your repo CSV):
--   \copy public._stg_dc_confirm_csv (id,name,company,address,city,state,zip,country,confirmation,confirmation_notes) FROM 'public/output_for_confirmation.csv' WITH (FORMAT csv, HEADER true);
--
-- Then run section 2 in the SQL Editor.
-- =============================================================================

-- 1) Staging table (column names match the CSV header; run once)
CREATE TABLE IF NOT EXISTS public._stg_dc_confirm_csv (
  id BIGINT NOT NULL,
  name TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  confirmation TEXT,
  confirmation_notes TEXT
);

-- 2) Apply updates: match CSV id → data_center_id; non-empty confirmation → link + confirmed true
UPDATE public.data_center_confirmations AS d
SET
  confirmation_link = NULLIF(TRIM(s.confirmation), ''),
  confirmed = (NULLIF(TRIM(s.confirmation), '') IS NOT NULL),
  updated_at = NOW()
FROM public._stg_dc_confirm_csv AS s
WHERE d.data_center_id = s.id::TEXT;

-- 3) Optional: see how many rows matched
-- SELECT COUNT(*) FROM public.data_center_confirmations d
-- INNER JOIN public._stg_dc_confirm_csv s ON d.data_center_id = s.id::TEXT;

-- 4) Optional: drop staging when finished
-- DROP TABLE IF EXISTS public._stg_dc_confirm_csv;
