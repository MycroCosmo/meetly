-- Limit direct API writes. Anonymous host operations must use an independently
-- authorized Edge Function, not the old owner_user_id IS NULL permission.
BEGIN;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Direct room updates require authenticated ownership" ON public.rooms;
CREATE POLICY "Direct room updates require authenticated ownership"
  ON public.rooms AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (owner_user_id IS NOT NULL AND auth.uid() = owner_user_id)
  WITH CHECK (owner_user_id IS NOT NULL AND auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Direct room deletes require authenticated ownership" ON public.rooms;
CREATE POLICY "Direct room deletes require authenticated ownership"
  ON public.rooms AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (owner_user_id IS NOT NULL AND auth.uid() = owner_user_id);

COMMIT;
