-- Contratista por defecto del proyecto: las tareas creadas vía wizard que no
-- traigan un asignado_a explícito caen aquí. El Admin que crea el proyecto
-- DEBE elegirlo. La FK es onDelete:SetNull para no romper proyectos si el
-- contratista se elimina (queda huérfano hasta que el admin reasigne).

ALTER TABLE "proyectos"
  ADD COLUMN IF NOT EXISTS "contratista_default_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "proyectos"
    ADD CONSTRAINT "proyectos_contratista_default_id_fkey"
    FOREIGN KEY ("contratista_default_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "proyectos_contratista_default_id_idx"
  ON "proyectos"("contratista_default_id");
