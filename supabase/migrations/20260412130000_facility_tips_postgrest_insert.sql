-- PostgREST uses the anon API key; the DB session role is often `anon` even with a user JWT.
-- RLS still enforces auth.uid() = submitted_by.
GRANT INSERT ON public.facility_tips TO anon;

DROP POLICY IF EXISTS "Allow authenticated insert facility tips" ON public.facility_tips;
DROP POLICY IF EXISTS "facility_tips_insert_own_row" ON public.facility_tips;

CREATE POLICY "facility_tips_insert_own_row"
  ON public.facility_tips
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND submitted_by = auth.uid()
  );
