-- Desglose de presupuesto POR TAREA (B2C, import de Excel único).
-- Opcionales: una tarea puede tener solo `precio` (total), solo M.O., solo
-- materiales, o el desglose completo. Cierra el diferido de la fase 5 anterior.

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN "presupuesto_mano_obra" INTEGER;
ALTER TABLE "tareas" ADD COLUMN "presupuesto_materiales" INTEGER;
