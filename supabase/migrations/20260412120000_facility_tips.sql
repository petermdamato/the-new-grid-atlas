-- User-submitted facility confirmation tips (links + note + geojson snapshot at submit time)
CREATE TABLE public.facility_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  facility_type TEXT NOT NULL CHECK (facility_type IN ('data_center', 'warehouse')),
  facility_subtype TEXT,
  facility_record_id TEXT NOT NULL,

  confirmation_link TEXT NOT NULL,
  note TEXT,

  facility_name TEXT,
  address TEXT,
  postal TEXT,
  company_name TEXT,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  capacity_type TEXT,
  warehouse_group TEXT,
  warehouse_type_raw TEXT,
  location_region TEXT
);

COMMENT ON TABLE public.facility_tips IS 'Confirmation tips from signed-in users; confirmation_link is comma-separated URLs.';

CREATE INDEX facility_tips_created_at_idx ON public.facility_tips (created_at DESC);
CREATE INDEX facility_tips_facility_idx ON public.facility_tips (facility_type, facility_record_id);
CREATE INDEX facility_tips_submitted_by_idx ON public.facility_tips (submitted_by);

ALTER TABLE public.facility_tips ENABLE ROW LEVEL SECURITY;

-- PostgREST (anon key + JWT) uses role `anon`; RLS checks auth.uid().
CREATE POLICY "facility_tips_insert_own_row"
  ON public.facility_tips
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND submitted_by = auth.uid()
  );

GRANT INSERT ON public.facility_tips TO anon;
GRANT INSERT ON public.facility_tips TO authenticated;
