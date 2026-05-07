CREATE TABLE "tareas_aprendidas" (
    "id" TEXT NOT NULL,
    "constructora_id" TEXT NOT NULL,
    "fase" TEXT NOT NULL,
    "subfase" TEXT,
    "espacio" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tiempo_acordado_dias" INTEGER NOT NULL,
    "precio" DOUBLE PRECISION,
    "marca_linea" TEXT,
    "componentes" TEXT,
    "proyectos_sin_uso_consecutivos" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_aprendidas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tareas_aprendidas_constructora_id_fase_espacio_nombre_key" ON "tareas_aprendidas"("constructora_id", "fase", "espacio", "nombre");

ALTER TABLE "tareas_aprendidas" ADD CONSTRAINT "tareas_aprendidas_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
