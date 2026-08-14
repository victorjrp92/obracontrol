-- Contactos del gate de datos de «Juntos» (/go/juntos/documentar).
-- Solo nombre/whatsapp/ciudad/audiencia/acepta_contacto/origen: la cédula y
-- la dirección del inmueble NUNCA se persisten (spec-go-juntos.md) — van solo
-- en el request del PDF, se imprimen y se descartan.

-- CreateTable
CREATE TABLE "contacto_juntos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "audiencia" TEXT NOT NULL,
    "acepta_contacto" BOOLEAN NOT NULL DEFAULT false,
    "origen" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacto_juntos_pkey" PRIMARY KEY ("id")
);
