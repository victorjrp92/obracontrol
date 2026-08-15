-- ════════════════════════════════════════════════════════════════════════════
-- SEC-01 — Cerrar la API pública de Supabase (PostgREST) sobre TODAS las tablas
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA
-- La llave `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` viaja al navegador
-- por diseño (la necesitan el login y Realtime) y cualquiera la saca del HTML.
-- Supabase publica automáticamente toda tabla del esquema `public` por su API
-- REST usando esa misma llave, SALVO que la tabla tenga RLS activo. Prisma crea
-- sus tablas en `public`. Hasta esta migración, RLS estaba activo en una sola:
-- `contacto_juntos` (ver 20260815120000_contacto_juntos, que ya explicaba el
-- mecanismo). Las otras 39 quedaban legibles: usuarios, obreros (cédula, EPS,
-- ARL), evidencias, audit_logs, consentimientos_datos, lista_espera_go.
--
-- POR QUÉ NO ROMPE LA APLICACIÓN
-- Prisma NO usa PostgREST: se conecta directo a Postgres con DATABASE_URL, y el
-- dueño de una tabla omite sus propias políticas de RLS. Toda la aplicación
-- sigue igual. Lo único que cambia es que la API pública deja de responder.
--
-- ⚠️ NUNCA usar FORCE ROW LEVEL SECURITY en estas tablas: eso SÍ aplicaría las
--    políticas al dueño y dejaría a Prisma sin acceso.
--
-- ⚠️ ANTES DE PRODUCCIÓN: correr esto en una rama de base de datos y verificar
--    (a) que la app entra y lista proyectos, y (b) las notificaciones en vivo
--    (ver el bloque 3). Si el rol de DATABASE_URL no fuera el dueño de las
--    tablas, haría falta darle BYPASSRLS — compruébalo con:
--      SELECT tableowner FROM pg_tables WHERE tablename = 'tareas';
--      SELECT current_user;
--
-- Rollback: prisma/migrations/20260815140000_rls_todas_las_tablas/rollback.sql

-- ─── 1. RLS en todas las tablas del esquema public ──────────────────────────
-- Sin políticas: PostgREST no devuelve ninguna fila. Es el estado que ya tenía
-- `contacto_juntos`, aplicado al resto.

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ─── 2. Quitarle los permisos a los roles públicos ──────────────────────────
-- Cinturón además de los tirantes: aunque una tabla futura naciera sin RLS, sin
-- GRANT tampoco sería legible. `ALTER DEFAULT PRIVILEGES` cubre las que cree
-- Prisma de aquí en adelante.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;

-- ─── 3. Excepción: notificaciones en vivo ───────────────────────────────────
-- `NotificacionesContext.tsx` se suscribe por Realtime a los INSERT de
-- `notificaciones` filtrando por usuario_id. Realtime SÍ pasa por PostgREST con
-- el rol `authenticated`, así que sin política se quedaría sin eventos.
--
-- Degradación conocida y aceptable si algo de esto fallara: el propio contexto
-- tiene un `setInterval(refetch, 60_000)` de respaldo, así que las
-- notificaciones seguirían llegando, solo que hasta 60 s más tarde.
--
-- La función es SECURITY DEFINER a propósito: necesita leer `usuarios` (que
-- ahora tiene RLS y ninguna política) para traducir el correo del JWT al id de
-- Prisma. `SET search_path` evita el secuestro por búsqueda de esquema.

CREATE OR REPLACE FUNCTION public.seiricon_usuario_actual_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.usuarios WHERE email = (auth.jwt() ->> 'email') LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.seiricon_usuario_actual_id() FROM public;
GRANT EXECUTE ON FUNCTION public.seiricon_usuario_actual_id() TO authenticated;

DROP POLICY IF EXISTS notificaciones_propias ON public.notificaciones;
CREATE POLICY notificaciones_propias
  ON public.notificaciones
  FOR SELECT
  TO authenticated
  USING (usuario_id = public.seiricon_usuario_actual_id());

-- Solo lectura, solo esta tabla, y solo de las filas propias por la política.
GRANT SELECT ON public.notificaciones TO authenticated;
