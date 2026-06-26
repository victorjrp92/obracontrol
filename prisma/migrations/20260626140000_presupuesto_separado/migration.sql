-- Presupuesto separado: además de presupuesto_total, dos bolsas opcionales
-- (mano de obra / materiales) para el modo "separado" del motor de costos.
-- Aditivo: ADD COLUMN nullable, no rompe nada existente.

-- AlterTable
ALTER TABLE "proyectos" ADD COLUMN "presupuesto_mano_obra" INTEGER;
ALTER TABLE "proyectos" ADD COLUMN "presupuesto_materiales" INTEGER;
