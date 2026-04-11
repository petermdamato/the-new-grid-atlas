-- "Details look wrong" reports: dropdown choice + facility snapshot at submit time
CREATE TABLE public.facility_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  facility_type TEXT NOT NULL CHECK (facility_type IN ('data_center', 'warehouse')),
  facility_record_id TEXT NOT NULL,
  report_option TEXT NOT NULL CHECK (
    report_option IN ('none_here', 'wrong_facility', 'closed', 'not_open')
  ),

  facility_name TEXT,
  address TEXT,
  postal TEXT,
  company_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  capacity_type TEXT,
  warehouse_group TEXT,
  warehouse_type_raw TEXT,
  location_region TEXT
);

COMMENT ON TABLE public.facility_updates IS 'User reports that facility details are wrong; includes snapshot and report_option.';

CREATE INDEX facility_updates_created_at_idx ON public.facility_updates (created_at DESC);
CREATE INDEX facility_updates_facility_idx ON public.facility_updates (facility_type, facility_record_id);
CREATE INDEX facility_updates_submitted_by_idx ON public.facility_updates (submitted_by);

ALTER TABLE public.facility_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_updates_insert_own_row"
  ON public.facility_updates
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND submitted_by = auth.uid()
  );

GRANT INSERT ON public.facility_updates TO anon;
GRANT INSERT ON public.facility_updates TO authenticated;
