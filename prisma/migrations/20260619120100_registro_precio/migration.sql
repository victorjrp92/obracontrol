-- Flywheel de precios (sin IA): rastro de cada precio fijado/editado por obra.
-- Sin foreign keys: proyecto_id/constructora_id son campos sueltos a propósito
-- (la captura pasiva no debe romper la creación/edición de obras, y el borrado
-- de una obra no debe cascar ni bloquear estos registros).

-- CreateTable
CREATE TABLE "registros_precio" (
    "id" TEXT NOT NULL,
    "tarea_normalizada" TEXT NOT NULL,
    "ciudad" TEXT,
    "tipo_obra" TEXT,
    "precio" INTEGER NOT NULL,
    "fuente" TEXT NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "constructora_id" TEXT,
    "proyecto_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_precio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_precio_tarea_normalizada_ciudad_idx" ON "registros_precio"("tarea_normalizada", "ciudad");
