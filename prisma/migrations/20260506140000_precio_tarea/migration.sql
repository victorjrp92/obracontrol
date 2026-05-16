-- Precio por tarea (COP). Opcional para no romper datos legacy.
-- Editable por SUPER_ADMIN, ADMIN_GENERAL, ADMIN_PROYECTO, DIRECTIVO y CONTRATISTA.
-- OBRERO no puede ver ni editar precios.

ALTER TABLE "tareas"
  ADD COLUMN IF NOT EXISTS "precio" DOUBLE PRECISION;

ALTER TABLE "tareas_sugeridas"
  ADD COLUMN IF NOT EXISTS "precio" DOUBLE PRECISION;
