-- Metraje total de la obra (m² de toda la obra, alternativa a metraje por espacio).
-- Aditivo: no rompe nada existente.

-- AlterTable
ALTER TABLE "proyectos" ADD COLUMN "metraje_total" DOUBLE PRECISION;
