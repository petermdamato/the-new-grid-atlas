-- Signed-in community impact notes per facility (map detail page)
CREATE TABLE public.community_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  facility_type TEXT NOT NULL CHECK (facility_type IN ('data_center', 'warehouse')),
  facility_record_id TEXT NOT NULL,
  note TEXT NOT NULL,

  pete_confirm BOOLEAN NULL
);

COMMENT ON TABLE public.community_notes IS 'User-submitted community impact notes; pete_confirm is NULL until reviewed.';
COMMENT ON COLUMN public.community_notes.pete_confirm IS 'NULL on insert; set when reviewed.';

CREATE INDEX community_notes_created_at_idx ON public.community_notes (created_at DESC);
CREATE INDEX community_notes_facility_idx ON public.community_notes (facility_type, facility_record_id);
CREATE INDEX community_notes_submitted_by_idx ON public.community_notes (submitted_by);

ALTER TABLE public.community_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_notes_insert_own_row"
  ON public.community_notes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND submitted_by = auth.uid()
  );

GRANT INSERT ON public.community_notes TO anon;
GRANT INSERT ON public.community_notes TO authenticated;
