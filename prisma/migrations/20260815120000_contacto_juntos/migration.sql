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

-- RLS: Supabase expone toda tabla nueva por su API pública (PostgREST) a
-- quien tenga la llave anon (pública en el cliente) salvo que RLS esté
-- activo. Esta tabla guarda nombre y WhatsApp de personas — se activa sin
-- policies: bloquea el acceso público por completo. La app sigue
-- funcionando porque Prisma se conecta directo a Postgres (DATABASE_URL),
-- no por la API de Supabase, y esa conexión no queda sujeta a RLS.
ALTER TABLE "contacto_juntos" ENABLE ROW LEVEL SECURITY;
