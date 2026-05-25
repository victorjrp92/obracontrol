-- Add nota_reporte column to tareas to store the note the contratista writes
-- when reporting a task as done (separate from `notas` which is admin-edited).
ALTER TABLE "tareas" ADD COLUMN "nota_reporte" TEXT;
