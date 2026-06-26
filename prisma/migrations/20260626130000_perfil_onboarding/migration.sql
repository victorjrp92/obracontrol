-- Cuestionario post-registro (Fase 2): respuestas del onboarding por perfil.
-- Una fila por cuenta (la cuenta = constructora, incl. las personales
-- CONTRATISTA/PROPIETARIO). El UNIQUE en constructora_id garantiza idempotencia
-- del upsert. FK con ON DELETE CASCADE: si se borra la cuenta, se borra su perfil.

-- CreateTable
CREATE TABLE "perfil_onboarding" (
    "id" TEXT NOT NULL,
    "constructora_id" TEXT NOT NULL,
    "tipo_cuenta" TEXT NOT NULL,
    "oficio" TEXT,
    "tamano_equipo" TEXT,
    "control_actual" TEXT,
    "primera_obra" BOOLEAN,
    "tiene_contratista" TEXT,
    "obras_activas" TEXT,
    "tipo_obra" TEXT,
    "num_contratistas" TEXT,
    "departamento" TEXT,
    "ciudad" TEXT,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfil_onboarding_constructora_id_key" ON "perfil_onboarding"("constructora_id");

-- AddForeignKey
ALTER TABLE "perfil_onboarding" ADD CONSTRAINT "perfil_onboarding_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
