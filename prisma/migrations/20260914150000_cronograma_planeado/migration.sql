-- Cronograma planeado: la línea base contra la que se mide el avance.
--
-- Hasta ahora el sistema sabía cuántos DÍAS dura una fase
-- (`fases.tiempo_estimado_dias`) pero no en qué FECHA cae. No es lo mismo:
-- con duraciones sueltas no se puede dibujar un cronograma ni calcular si la
-- obra va adelantada, porque en una obra de varias torres las fases se
-- solapan y encadenarlas en fila produce un calendario falso.
--
-- Sin esto el informe solo puede escribir «49% ejecutado». Con esto escribe
-- «49% ejecutado contra 44,0% programado», que es el indicador que calculan
-- los informes de interventoría reales — y lo calculan en unidades físicas,
-- sin un solo dato de costo.
--
-- Todo es ADITIVO y NULLABLE: las obras que ya existen siguen funcionando
-- exactamente igual, sin cronograma, hasta que alguien se lo cargue.

CREATE TYPE "ModoCronograma" AS ENUM ('AUTOMATICO', 'FASES', 'MANUAL');

ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "modo_cronograma" "ModoCronograma";

ALTER TABLE "fases"  ADD COLUMN IF NOT EXISTS "fecha_inicio_plan" TIMESTAMP(3);
ALTER TABLE "fases"  ADD COLUMN IF NOT EXISTS "fecha_fin_plan"    TIMESTAMP(3);

ALTER TABLE "tareas" ADD COLUMN IF NOT EXISTS "fecha_inicio_plan" TIMESTAMP(3);
ALTER TABLE "tareas" ADD COLUMN IF NOT EXISTS "fecha_fin_plan"    TIMESTAMP(3);

-- Índice para la consulta que más va a doler: «qué debía estar en curso hoy».
CREATE INDEX IF NOT EXISTS "tareas_fecha_inicio_plan_idx" ON "tareas" ("fecha_inicio_plan");
