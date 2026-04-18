-- Rename the existing enum value ADMINISTRADOR -> ADMIN_GENERAL.
-- PostgreSQL supports renaming enum values atomically and preserves all existing rows.
ALTER TYPE "NivelAcceso" RENAME VALUE 'ADMINISTRADOR' TO 'ADMIN_GENERAL';

-- Add the new enum value.
ALTER TYPE "NivelAcceso" ADD VALUE 'ADMIN_PROYECTO';

-- Create the admin_proyecto_access join table.
CREATE TABLE "admin_proyecto_access" (
  "id" TEXT NOT NULL,
  "usuario_id" TEXT NOT NULL,
  "proyecto_id" TEXT NOT NULL,
  "asignado_por" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_proyecto_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_proyecto_access_usuario_id_proyecto_id_key"
  ON "admin_proyecto_access"("usuario_id", "proyecto_id");

ALTER TABLE "admin_proyecto_access"
  ADD CONSTRAINT "admin_proyecto_access_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_proyecto_access"
  ADD CONSTRAINT "admin_proyecto_access_proyecto_id_fkey"
  FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_proyecto_access"
  ADD CONSTRAINT "admin_proyecto_access_asignado_por_fkey"
  FOREIGN KEY ("asignado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
