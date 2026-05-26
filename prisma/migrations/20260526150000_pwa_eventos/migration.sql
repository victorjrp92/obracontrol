-- PWA event tracking: install funnel + active PWA usage telemetry.
CREATE TYPE "PwaEventoTipo" AS ENUM (
  'PROMPT_SHOWN',
  'INSTALL_ACCEPTED',
  'INSTALL_DISMISSED',
  'APP_INSTALLED',
  'LAUNCHED_STANDALONE',
  'IOS_INSTRUCTIONS_SHOWN'
);

CREATE TABLE "pwa_eventos" (
  "id" TEXT NOT NULL,
  "evento" "PwaEventoTipo" NOT NULL,
  "plataforma" TEXT NOT NULL,
  "navegador" TEXT,
  "usuario_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pwa_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pwa_eventos_evento_idx" ON "pwa_eventos"("evento");
CREATE INDEX "pwa_eventos_created_at_idx" ON "pwa_eventos"("created_at");
CREATE INDEX "pwa_eventos_usuario_id_idx" ON "pwa_eventos"("usuario_id");

ALTER TABLE "pwa_eventos"
  ADD CONSTRAINT "pwa_eventos_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
