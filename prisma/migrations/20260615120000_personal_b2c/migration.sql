-- Seiricon Personal (B2C): módulo "Gastos y materiales" + contexto/telemetría de negocio.
-- Todo aditivo: no rompe nada del B2B.

-- CreateEnum
CREATE TYPE "EstadoGasto" AS ENUM ('REGISTRADO', 'APROBADO', 'RECHAZADO');

-- AlterTable: contexto B2C + índice de negocio
ALTER TABLE "proyectos" ADD COLUMN     "tipo_obra" TEXT,
ADD COLUMN     "tipo_propiedad" TEXT,
ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "presupuesto_total" INTEGER;

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "espacio_id" TEXT,
    "tarea_id" TEXT,
    "descripcion" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "factura_url" TEXT,
    "estado" "EstadoGasto" NOT NULL DEFAULT 'REGISTRADO',
    "registrado_por" TEXT NOT NULL,
    "aprobado_por" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "material" TEXT,
    "cantidad" DOUBLE PRECISION,
    "unidad" TEXT,
    "precio_unitario" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anticipos" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "entregado_a" TEXT,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anticipos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_proyecto_id_idx" ON "gastos"("proyecto_id");

-- CreateIndex
CREATE INDEX "gastos_estado_idx" ON "gastos"("estado");

-- CreateIndex
CREATE INDEX "anticipos_proyecto_id_idx" ON "anticipos"("proyecto_id");

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "espacios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_aprobado_por_fkey" FOREIGN KEY ("aprobado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_entregado_a_fkey" FOREIGN KEY ("entregado_a") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anticipos" ADD CONSTRAINT "anticipos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
