-- Map "Submit a tip" rows: no geojson id yet; optional confirmation URLs
ALTER TABLE public.facility_tips
  ALTER COLUMN facility_record_id DROP NOT NULL;

ALTER TABLE public.facility_tips
  ALTER COLUMN confirmation_link DROP NOT NULL;

COMMENT ON COLUMN public.facility_tips.facility_record_id IS 'GeoJSON id or warehouse code for on-page confirmations; NULL for map missing-facility tips.';
COMMENT ON COLUMN public.facility_tips.confirmation_link IS 'Comma-separated source URLs when provided; NULL if the tip has no link.';
