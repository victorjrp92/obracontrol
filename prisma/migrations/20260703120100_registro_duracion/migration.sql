-- Flywheel de duraciones (sin IA): rastro de días reales vs. estimados cada
-- vez que una tarea se aprueba con fecha_inicio + fecha de fin real.
-- Sin foreign keys: proyecto_id/constructora_id son campos sueltos a propósito
-- (la captura pasiva no debe romper la aprobación, y el borrado de una obra no
-- debe cascar ni bloquear estos registros). Mismo criterio que registros_precio.

-- CreateTable
CREATE TABLE "registros_duracion" (
    "id" TEXT NOT NULL,
    "tarea_normalizada" TEXT NOT NULL,
    "fase" TEXT NOT NULL,
    "ciudad" TEXT,
    "metraje" DOUBLE PRECISION,
    "dias_estimados" DOUBLE PRECISION NOT NULL,
    "dias_reales" DOUBLE PRECISION NOT NULL,
    "proyecto_id" TEXT,
    "constructora_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_duracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_duracion_tarea_normalizada_ciudad_idx" ON "registros_duracion"("tarea_normalizada", "ciudad");
