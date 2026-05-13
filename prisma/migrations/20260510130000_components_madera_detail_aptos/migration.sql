ALTER TABLE "unidades" ADD COLUMN "nombre_personalizado" TEXT;
ALTER TABLE "tareas" ADD COLUMN "tiene_estructura" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tareas" ADD COLUMN "tiene_nave" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tareas" ADD COLUMN "tiene_chapa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tareas" ADD COLUMN "tiene_cartera" BOOLEAN NOT NULL DEFAULT false;
