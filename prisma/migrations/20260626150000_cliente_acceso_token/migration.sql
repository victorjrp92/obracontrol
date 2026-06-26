-- Vista del cliente (Fase 6): enlace público de SOLO LECTURA del avance.
-- El Contratista B2C comparte un token por proyecto con su cliente; el cliente
-- VE el progreso (sin reportar, sin login). Read-only.
-- `token` es aleatorio urlsafe y UNIQUE (no expone orden de creación).
-- FK con ON DELETE CASCADE: si se borra la obra, se borran sus tokens.
-- Máximo 1 token activo por proyecto se garantiza en la capa de aplicación
-- (regenerar desactiva los anteriores).

-- CreateTable
CREATE TABLE "cliente_acceso_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_acceso_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cliente_acceso_token_token_key" ON "cliente_acceso_token"("token");

-- CreateIndex
CREATE INDEX "cliente_acceso_token_proyecto_id_idx" ON "cliente_acceso_token"("proyecto_id");

-- AddForeignKey
ALTER TABLE "cliente_acceso_token" ADD CONSTRAINT "cliente_acceso_token_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
