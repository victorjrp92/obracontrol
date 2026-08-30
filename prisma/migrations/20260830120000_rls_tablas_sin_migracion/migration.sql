-- ════════════════════════════════════════════════════════════════════════════
-- SEC-09 — RLS para las tablas que nunca tuvieron migración
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA
-- Tres tablas viven en `prisma/schema.prisma` y NO las crea ninguna migración:
-- `audit_logs`, `mensajes_contacto` y `consentimientos_datos`. Entraron en la
-- base por `prisma db push`, que aplica el esquema sin dejar migración detrás.
--
-- Mientras entraran ANTES del barrido de 20260815140000, quedaban cerradas: ese
-- barrido recorre `pg_tables`, o sea las tablas REALES, no las migraciones. Pero
-- cualquier `db push` posterior las recrearía —o crearía otras nuevas— sin RLS,
-- y entonces lo único que las taparía sería el `REVOKE`/`ALTER DEFAULT
-- PRIVILEGES` del bloque 2 de aquella migración. Un solo cinturón, sin tirantes,
-- sobre tres tablas que son justo las que no conviene: `consentimientos_datos`
-- guarda la IP y el user-agent del titular (Ley 1581), `mensajes_contacto` el
-- nombre, el correo y el texto de quien escribe por el formulario público, y
-- `audit_logs` el valor anterior y el nuevo de cada campo editado.
--
-- QUÉ HACE ESTO
-- Reafirma RLS sobre las tres, sin crearlas y sin tocar una sola fila.
-- `ALTER TABLE IF EXISTS` no falla si la tabla todavía no está, y activar RLS
-- sobre una que ya lo tiene no es un error: la migración es idempotente y se
-- puede correr en cualquier entorno, esté como esté.
--
-- Prisma se conecta como dueño y el dueño se salta sus propias políticas, así
-- que la aplicación no cambia. Lo que cambia es que la API pública de Supabase
-- deja de responder por ellas aunque alguien les devuelva el GRANT.
--
-- ⚠️ NO arregla la causa: el esquema y las migraciones siguen desalineados y
--    `prisma migrate deploy` NO puede levantar una base desde cero mientras esas
--    tres tablas no tengan su `CREATE TABLE`. Eso es una decisión de
--    infraestructura (¿la fuente de verdad es `migrate` o `db push`?) y se deja
--    reportada, no resuelta aquí.
--
-- ⚠️ NUNCA usar FORCE ROW LEVEL SECURITY: eso SÍ aplicaría las políticas al
--    dueño y dejaría a Prisma sin acceso.

ALTER TABLE IF EXISTS "audit_logs"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mensajes_contacto"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "consentimientos_datos" ENABLE ROW LEVEL SECURITY;

-- El cinturón, otra vez: cubre de paso cualquier tabla que haya entrado por
-- `db push` desde el barrido. Es idempotente y no toca datos.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- La única excepción sigue siendo la lectura de `notificaciones` que necesita
-- Realtime (bloque 3 de 20260815140000). El REVOKE de arriba se la acaba de
-- quitar, así que se repone aquí — su política de fila propia sigue en pie.
GRANT SELECT ON public.notificaciones TO authenticated;
