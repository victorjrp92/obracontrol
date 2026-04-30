-- Número de registro: trazabilidad business-side de proyectos y tareas.

-- Proyecto: string opcional, único por constructora cuando no es null.
ALTER TABLE "proyectos"
  ADD COLUMN IF NOT EXISTS "numero_registro" TEXT;

-- Constraint único por (constructora_id, numero_registro). NULL no conflicto en Postgres.
DO $$ BEGIN
  CREATE UNIQUE INDEX "proyectos_constructora_id_numero_registro_key"
    ON "proyectos"("constructora_id", "numero_registro");
EXCEPTION WHEN duplicate_table THEN null;
END $$;

-- Tarea: número derivado del proyecto, sin unicidad explícita (la garantiza
-- el formato {proj}-T{seq} si los números de proyecto son únicos).
ALTER TABLE "tareas"
  ADD COLUMN IF NOT EXISTS "numero_registro" TEXT;
