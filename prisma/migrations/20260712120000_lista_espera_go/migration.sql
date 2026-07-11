-- Lista de espera de Seiricon Go (landing B2C /go-nueva): CTA "Reserva tu cupo".
-- `correo` UNIQUE: el API hace upsert (sin duplicados y sin revelar si el
-- correo ya estaba). Sin foreign keys: captura pública anterior al registro.

-- CreateTable
CREATE TABLE "lista_espera_go" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "audiencia" TEXT NOT NULL,
    "respuesta" TEXT NOT NULL,
    "origen" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lista_espera_go_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lista_espera_go_correo_key" ON "lista_espera_go"("correo");
