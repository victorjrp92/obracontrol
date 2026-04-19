-- Add optional estimated days to Fase
ALTER TABLE "fases" ADD COLUMN "tiempo_estimado_dias" INTEGER;

-- Add optional total square meters to Unidad
ALTER TABLE "unidades" ADD COLUMN "metraje_total" DOUBLE PRECISION;
