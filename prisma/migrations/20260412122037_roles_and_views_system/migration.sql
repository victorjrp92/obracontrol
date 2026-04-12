-- CreateEnum
CREATE TYPE "NivelAcceso" AS ENUM ('DIRECTIVO', 'ADMINISTRADOR', 'CONTRATISTA', 'OBRERO');

-- CreateEnum
CREATE TYPE "EstadoSugerencia" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('TAREA_APROBADA', 'TAREA_RECHAZADA', 'SUGERENCIA_NUEVA', 'SUGERENCIA_APROBADA', 'SUGERENCIA_RECHAZADA', 'OBRERO_REPORTO');

-- DropForeignKey
ALTER TABLE "evidencias" DROP CONSTRAINT "evidencias_tomada_por_fkey";

-- AlterTable
ALTER TABLE "edificios" ADD COLUMN     "es_zona_comun" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "evidencias" ADD COLUMN     "obrero_id" TEXT,
ALTER COLUMN "tomada_por" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "foto_referencia_url" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "rol_id" TEXT;

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "constructora_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivel_acceso" "NivelAcceso" NOT NULL,
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obreros" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "contratista_id" TEXT NOT NULL,
    "constructora_id" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obreros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_sugeridas" (
    "id" TEXT NOT NULL,
    "contratista_id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "edificio_id" TEXT,
    "unidades" JSONB NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "foto_url" TEXT,
    "estado" "EstadoSugerencia" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "revisado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_sugeridas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_constructora_id_nombre_key" ON "roles"("constructora_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "obreros_token_key" ON "obreros"("token");

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_tomada_por_fkey" FOREIGN KEY ("tomada_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_obrero_id_fkey" FOREIGN KEY ("obrero_id") REFERENCES "obreros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obreros" ADD CONSTRAINT "obreros_contratista_id_fkey" FOREIGN KEY ("contratista_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obreros" ADD CONSTRAINT "obreros_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_sugeridas" ADD CONSTRAINT "tareas_sugeridas_contratista_id_fkey" FOREIGN KEY ("contratista_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_sugeridas" ADD CONSTRAINT "tareas_sugeridas_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_sugeridas" ADD CONSTRAINT "tareas_sugeridas_revisado_por_fkey" FOREIGN KEY ("revisado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
