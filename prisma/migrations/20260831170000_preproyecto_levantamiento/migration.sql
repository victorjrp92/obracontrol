-- ═══════════════════════════════════════════════════════════════════════════
-- PREPROYECTO: el estado en el que se cotiza.
--
-- Un preproyecto es un `Proyecto` con estado propio, no una entidad aparte.
-- Hacerlo entidad obligaría a duplicar tenancy, permisos y RLS para algo que
-- termina siendo el mismo objeto tres semanas después. Y como el cobro mira
-- `estado = 'ACTIVO'`, cotizar no consume cupo del plan sin tocar una línea de
-- facturación.
--
-- `PREPROYECTO` va ANTES de `ACTIVO` en el orden del enum para que ordenar por
-- estado ponga primero lo que aún no arranca, que es como se lee un embudo.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TYPE "EstadoProyecto" ADD VALUE IF NOT EXISTS 'PREPROYECTO' BEFORE 'ACTIVO';

-- La cotización firmada es el acto que cierra el trato: mismo folio, misma
-- huella y mismo versionado que el resto de documentos firmables.
ALTER TYPE "TipoDocumentoFirmable" ADD VALUE IF NOT EXISTS 'COTIZACION' BEFORE 'ACTA_ESTADO_INICIAL';

-- ═══════════════════════════════════════════════════════════════════════════
-- El LEVANTAMIENTO fotográfico.
--
-- Tabla propia y no `evidencias` con `tarea_id` nulo. `evidencias` es la cadena
-- que respalda las aprobaciones y con ellas los pagos; volver su `tarea_id`
-- opcional metería un caso nulo en toda consulta que decide si una tarea se
-- puede aprobar. Además son cosas distintas: una evidencia prueba que algo se
-- HIZO, un levantamiento documenta cómo estaba ANTES.
--
-- `espacio_id` es nulo a propósito: en obra se disparan cuarenta fotos seguidas
-- y elegir espacio en cada una mata el flujo. Se asocian después.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "fotos_levantamiento" (
  "id"                TEXT         NOT NULL,
  "proyecto_id"       TEXT         NOT NULL,
  "espacio_id"        TEXT,
  "url_storage"       TEXT         NOT NULL,
  "descripcion"       TEXT,
  "gps_lat"           DOUBLE PRECISION,
  "gps_lng"           DOUBLE PRECISION,
  "timestamp_captura" TIMESTAMP(3) NOT NULL,
  "tomada_por"        TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fotos_levantamiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fotos_levantamiento_proyecto_id_idx" ON "fotos_levantamiento"("proyecto_id");
CREATE INDEX IF NOT EXISTS "fotos_levantamiento_espacio_id_idx"  ON "fotos_levantamiento"("espacio_id");

-- El proyecto CASCADEA: si se borra el preproyecto se van sus fotos, que es lo
-- que el usuario espera al descartar una cotización. El espacio hace SET NULL:
-- reorganizar los espacios de una obra no puede borrar el registro de cómo
-- estaba antes — la foto sobrevive y queda sin asociar, para reasociarla.
DO $$
BEGIN
  ALTER TABLE "fotos_levantamiento"
    ADD CONSTRAINT "fotos_levantamiento_proyecto_id_fkey"
    FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fotos_levantamiento"
    ADD CONSTRAINT "fotos_levantamiento_espacio_id_fkey"
    FOREIGN KEY ("espacio_id") REFERENCES "espacios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "fotos_levantamiento"
    ADD CONSTRAINT "fotos_levantamiento_tomada_por_fkey"
    FOREIGN KEY ("tomada_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS. Toda tabla nueva nace cerrada.
--
-- Sin esto la tabla queda legible por el rol `anon` a través de la API de
-- Supabase, que es exactamente el agujero que dejó 39 tablas expuestas antes de
-- la migración 20260830120000. El acceso a datos va por el servidor de Next con
-- el service role, así que ni `anon` ni `authenticated` necesitan nada aquí.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "fotos_levantamiento" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "fotos_levantamiento" FROM anon;
REVOKE ALL ON TABLE "fotos_levantamiento" FROM authenticated;
