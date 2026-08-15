-- Rollback de 20260815140000_rls_todas_las_tablas.
--
-- Este archivo NO lo ejecuta Prisma: es para pegarlo a mano si tras activar RLS
-- algo deja de funcionar y hace falta volver atrás mientras se diagnostica.
--
-- ⚠️ Volver atrás reabre la API pública de Supabase sobre todas las tablas
--    (SEC-01). Es un estado de emergencia, no un lugar donde quedarse.
--
-- `contacto_juntos` se deja FUERA a propósito: su RLS es anterior a esta
-- migración y debe seguir activo pase lo que pase — guarda nombre y WhatsApp.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('_prisma_migrations', 'contacto_juntos')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS notificaciones_propias ON public.notificaciones;
DROP FUNCTION IF EXISTS public.seiricon_usuario_actual_id();

-- Devolver los permisos por defecto de Supabase.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
