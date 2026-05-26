-- Enable Supabase Realtime on the `notificaciones` table so clients can
-- subscribe to INSERTs and receive new notifications instantly (no polling).
-- Use DO block + EXCEPTION to be idempotent if the table is already in the
-- publication.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
