-- CreateTable
CREATE TABLE "reasignaciones_tarea" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "contratista_anterior_id" TEXT,
    "contratista_nuevo_id" TEXT,
    "realizado_por" TEXT NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reasignaciones_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reasignaciones_tarea_tarea_id_idx" ON "reasignaciones_tarea"("tarea_id");

-- CreateIndex
CREATE INDEX "reasignaciones_tarea_proyecto_id_idx" ON "reasignaciones_tarea"("proyecto_id");

-- AddForeignKey
ALTER TABLE "reasignaciones_tarea" ADD CONSTRAINT "reasignaciones_tarea_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignaciones_tarea" ADD CONSTRAINT "reasignaciones_tarea_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignaciones_tarea" ADD CONSTRAINT "reasignaciones_tarea_contratista_anterior_id_fkey" FOREIGN KEY ("contratista_anterior_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignaciones_tarea" ADD CONSTRAINT "reasignaciones_tarea_contratista_nuevo_id_fkey" FOREIGN KEY ("contratista_nuevo_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reasignaciones_tarea" ADD CONSTRAINT "reasignaciones_tarea_realizado_por_fkey" FOREIGN KEY ("realizado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
