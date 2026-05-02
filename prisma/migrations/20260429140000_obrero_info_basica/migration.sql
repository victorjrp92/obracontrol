-- Información básica + scoring del Obrero.
-- Los campos básicos quedan nullable para no romper filas existentes;
-- la API exige todos los obligatorios al crear nuevos.

-- 1. Enum de especialidad
DO $$ BEGIN
  CREATE TYPE "EspecialidadObrero" AS ENUM (
    'ALBANIL',
    'INSTALADOR',
    'ELECTRICISTA',
    'PLOMERO',
    'PINTOR',
    'CARPINTERO',
    'ENCHAPADOR',
    'ESTUCADOR',
    'AYUDANTE',
    'OTRO'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Información básica
ALTER TABLE "obreros"
  ADD COLUMN IF NOT EXISTS "cedula"                       TEXT,
  ADD COLUMN IF NOT EXISTS "telefono"                     TEXT,
  ADD COLUMN IF NOT EXISTS "especialidad"                 "EspecialidadObrero",
  ADD COLUMN IF NOT EXISTS "eps"                          TEXT,
  ADD COLUMN IF NOT EXISTS "arl"                          TEXT,
  ADD COLUMN IF NOT EXISTS "fecha_nacimiento"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "direccion"                    TEXT,
  ADD COLUMN IF NOT EXISTS "contacto_emergencia"          TEXT,
  ADD COLUMN IF NOT EXISTS "contacto_emergencia_telefono" TEXT,
  ADD COLUMN IF NOT EXISTS "tipo_sangre"                  TEXT,
  ADD COLUMN IF NOT EXISTS "anos_experiencia"             INTEGER,
  ADD COLUMN IF NOT EXISTS "foto_url"                     TEXT;

-- 3. Scoring
ALTER TABLE "obreros"
  ADD COLUMN IF NOT EXISTS "score_total"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "score_calidad"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "score_velocidad"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "score_cumplimiento"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "evidencias_aprobadas"  INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "evidencias_rechazadas" INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tareas_completadas"    INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "historial_scores"      JSONB            NOT NULL DEFAULT '[]'::jsonb;

-- 4. Unicidad (constructora_id, cedula). NULL no conflictiva en Postgres.
DO $$ BEGIN
  CREATE UNIQUE INDEX "obreros_constructora_id_cedula_key"
    ON "obreros"("constructora_id", "cedula");
EXCEPTION WHEN duplicate_table THEN null;
END $$;
