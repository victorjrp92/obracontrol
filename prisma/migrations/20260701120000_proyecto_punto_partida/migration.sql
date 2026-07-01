-- Punto de partida de la obra (estado): NUEVA | MEDIAS | AVANZADA.
-- Se persiste para precargar el wizard en edición (antes arrancaba forzado a MEDIAS).
-- Aditivo: ADD COLUMN nullable, no rompe nada existente.

-- AlterTable
ALTER TABLE "proyectos" ADD COLUMN "punto_partida" TEXT;
