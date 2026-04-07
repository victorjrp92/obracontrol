-- CreateEnum
CREATE TYPE "PlanTipo" AS ENUM ('OBRA', 'PROYECTO', 'EMPRESA');

-- CreateEnum
CREATE TYPE "SubtipoProyecto" AS ENUM ('CASAS', 'APARTAMENTOS');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('ACTIVO', 'PAUSADO', 'COMPLETADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'REPORTADA', 'APROBADA', 'NO_APROBADA');

-- CreateEnum
CREATE TYPE "TipoEvidencia" AS ENUM ('FOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('APROBADA', 'NO_APROBADA');

-- CreateEnum
CREATE TYPE "TipoRetraso" AS ENUM ('POR_CONTRATISTA', 'POR_FALTA_PISTA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO', 'PARCIAL');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'JEFE_OPERACIONES', 'COORDINADOR', 'ASISTENTE', 'AUXILIAR', 'CONTRATISTA_INSTALADOR', 'CONTRATISTA_LUSTRADOR');

-- CreateTable
CREATE TABLE "constructoras" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "logo_url" TEXT,
    "plan_suscripcion" "PlanTipo" NOT NULL DEFAULT 'OBRA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constructoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "constructora_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ubicacion_lat" DOUBLE PRECISION,
    "ubicacion_lng" DOUBLE PRECISION,
    "subtipo" "SubtipoProyecto" NOT NULL,
    "dias_habiles_semana" INTEGER NOT NULL DEFAULT 5,
    "checklists_habilitados" BOOLEAN NOT NULL DEFAULT false,
    "dependencias_habilitadas" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_habilitado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin_estimada" TIMESTAMP(3),
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edificios" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "num_pisos" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edificios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pisos" (
    "id" TEXT NOT NULL,
    "edificio_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" TEXT NOT NULL,
    "piso_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_unidad_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_unidad" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espacios" (
    "id" TEXT NOT NULL,
    "unidad_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "metraje" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espacios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fases" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL,
    "fase_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo_referencia" TEXT,
    "nombre_pieza" TEXT,
    "marca_linea" TEXT,
    "componentes" TEXT,
    "cantidad_material_planeada" DOUBLE PRECISION,
    "unidad_material" TEXT,
    "tiempo_acordado_dias" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin_real" TIMESTAMP(3),
    "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
    "asignado_a" TEXT,
    "depende_de" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidencias" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "tipo" "TipoEvidencia" NOT NULL,
    "url_storage" TEXT NOT NULL,
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "timestamp_captura" TIMESTAMP(3) NOT NULL,
    "tomada_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprobaciones" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "aprobador_id" TEXT NOT NULL,
    "estado" "EstadoAprobacion" NOT NULL,
    "items_no_aprobados" JSONB,
    "justificacion_por_item" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprobaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre_tarea_patron" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_respuestas" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "items_completados" JSONB NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retrasos" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "tipo" "TipoRetraso" NOT NULL,
    "justificacion" TEXT NOT NULL,
    "evidencia_urls" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retrasos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extensiones_tiempo" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "dias_adicionales" INTEGER NOT NULL,
    "justificacion" TEXT NOT NULL,
    "documentacion_url" TEXT NOT NULL,
    "autorizado_por" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extensiones_tiempo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumo_materiales" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "cantidad_real" DOUBLE PRECISION NOT NULL,
    "piezas_danadas" INTEGER NOT NULL DEFAULT 0,
    "notas_dano" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumo_materiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "constructora_id" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratistas" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "score_cumplimiento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_calidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_velocidad_correccion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "historial_scores" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_contratistas" (
    "id" TEXT NOT NULL,
    "contratista_id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fin" TIMESTAMP(3) NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "retegarantia_porcentaje" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "monto_retenido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "visible_para_contratista" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_contratistas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "constructoras_nit_key" ON "constructoras"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_respuestas_tarea_id_key" ON "checklist_respuestas"("tarea_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumo_materiales_tarea_id_key" ON "consumo_materiales"("tarea_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contratistas_usuario_id_key" ON "contratistas"("usuario_id");

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edificios" ADD CONSTRAINT "edificios_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pisos" ADD CONSTRAINT "pisos_edificio_id_fkey" FOREIGN KEY ("edificio_id") REFERENCES "edificios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_piso_id_fkey" FOREIGN KEY ("piso_id") REFERENCES "pisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_tipo_unidad_id_fkey" FOREIGN KEY ("tipo_unidad_id") REFERENCES "tipos_unidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_unidad" ADD CONSTRAINT "tipos_unidad_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacios" ADD CONSTRAINT "espacios_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fases" ADD CONSTRAINT "fases_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_fase_id_fkey" FOREIGN KEY ("fase_id") REFERENCES "fases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_depende_de_fkey" FOREIGN KEY ("depende_de") REFERENCES "tareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_tomada_por_fkey" FOREIGN KEY ("tomada_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprobaciones" ADD CONSTRAINT "aprobaciones_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_respuestas" ADD CONSTRAINT "checklist_respuestas_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retrasos" ADD CONSTRAINT "retrasos_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensiones_tiempo" ADD CONSTRAINT "extensiones_tiempo_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensiones_tiempo" ADD CONSTRAINT "extensiones_tiempo_autorizado_por_fkey" FOREIGN KEY ("autorizado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumo_materiales" ADD CONSTRAINT "consumo_materiales_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratistas" ADD CONSTRAINT "contratistas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_contratistas" ADD CONSTRAINT "pagos_contratistas_contratista_id_fkey" FOREIGN KEY ("contratista_id") REFERENCES "contratistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_contratistas" ADD CONSTRAINT "pagos_contratistas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
