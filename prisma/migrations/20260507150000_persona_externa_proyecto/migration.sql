-- CreateTable
CREATE TABLE "personas_externas_proyecto" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personas_externas_proyecto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "personas_externas_proyecto" ADD CONSTRAINT "personas_externas_proyecto_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
