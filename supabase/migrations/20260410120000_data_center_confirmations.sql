-- Per–data center confirmation (matches properties.id from data_centers.geojson)
CREATE TABLE public.data_center_confirmations (
  data_center_id TEXT PRIMARY KEY,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirmation_link TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.data_center_confirmations IS 'Editorial confirmation for map data centers; confirmation_link is comma-separated URLs.';

CREATE INDEX data_center_confirmations_confirmed_idx ON public.data_center_confirmations (confirmed);

ALTER TABLE public.data_center_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read data center confirmations"
  ON public.data_center_confirmations
  FOR SELECT
  TO anon, authenticated
  USING (true);
