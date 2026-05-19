-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "constructora_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- Add cliente_id to proyectos
ALTER TABLE "proyectos" ADD COLUMN "cliente_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clientes_constructora_id_nombre_key" ON "clientes"("constructora_id", "nombre");

-- CreateIndex
CREATE INDEX "proyectos_cliente_id_idx" ON "proyectos"("cliente_id");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
