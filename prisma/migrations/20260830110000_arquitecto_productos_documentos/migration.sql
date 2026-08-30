-- ════════════════════════════════════════════════════════════════════════════
-- Perfil Arquitecto · datos del inmueble · productos técnicos · documentos
-- firmables · medición correcta de duración
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Perfil Arquitecto ───────────────────────────────────────────────────
ALTER TYPE "TipoCuenta" ADD VALUE IF NOT EXISTS 'ARQUITECTO';

-- ─── 2. Personal en obra: localizable y con a quién avisar ──────────────────
ALTER TABLE "personas_externas_proyecto" ADD COLUMN IF NOT EXISTS "direccion" TEXT;
ALTER TABLE "personas_externas_proyecto" ADD COLUMN IF NOT EXISTS "contacto_emergencia" TEXT;

-- ─── 3. Datos del inmueble ──────────────────────────────────────────────────
-- Los pide el acta de estado inicial y cualquier informe técnico. La matrícula
-- inmobiliaria es el identificador legal del predio en Colombia.
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "matricula_inmobiliaria" TEXT;
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "direccion_inmueble"     TEXT;
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "conjunto_edificio"      TEXT;
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "unidad_inmueble"        TEXT;
-- Dice bajo qué norma sísmica se construyó: <1984 sin código, CCCSR-84,
-- NSR-98, NSR-10.
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "anio_construccion"      INTEGER;
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "altura_libre_m"         DOUBLE PRECISION;
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "habitada_durante_obra"  BOOLEAN;
ALTER TABLE "proyectos" ADD COLUMN IF NOT EXISTS "solicitante"            TEXT;

-- ─── 4. Medir la duración correcta ──────────────────────────────────────────
-- `dias_estimados` mide el PLAN DEL USUARIO: repartirGlobal() lo sobrescribe
-- con el reparto del plazo que él puso. `dias_motor` es lo que predijo el
-- algoritmo. Sin esa separación no se puede calcular el error del motor.
ALTER TABLE "registros_duracion" ADD COLUMN IF NOT EXISTS "dias_motor"          DOUBLE PRECISION;
ALTER TABLE "registros_duracion" ADD COLUMN IF NOT EXISTS "dias_reales_habiles" DOUBLE PRECISION;
ALTER TABLE "registros_duracion" ADD COLUMN IF NOT EXISTS "cantidad"            DOUBLE PRECISION;
ALTER TABLE "registros_duracion" ADD COLUMN IF NOT EXISTS "unidad"              TEXT;
ALTER TABLE "registros_duracion" ADD COLUMN IF NOT EXISTS "cuadrillas"          INTEGER;

-- ─── 5. Productos técnicos ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "TipoProductoTecnico" AS ENUM ('REGISTRO_INICIAL', 'PLANO', 'RENDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "productos_tecnicos" (
    "id"            TEXT NOT NULL,
    "proyecto_id"   TEXT NOT NULL,
    "piso_id"       TEXT,
    "unidad_id"     TEXT,
    "tipo"          "TipoProductoTecnico" NOT NULL,
    "nombre"        TEXT NOT NULL,
    "descripcion"   TEXT,
    "storage_path"  TEXT NOT NULL,
    "mime"          TEXT NOT NULL,
    "bytes"         INTEGER NOT NULL,
    "version"       INTEGER NOT NULL DEFAULT 1,
    "vigente"       BOOLEAN NOT NULL DEFAULT true,
    "reemplaza_a"   TEXT,
    "subido_por_id" TEXT NOT NULL,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "productos_tecnicos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "productos_tecnicos_proyecto_id_tipo_idx"    ON "productos_tecnicos"("proyecto_id", "tipo");
CREATE INDEX IF NOT EXISTS "productos_tecnicos_proyecto_id_vigente_idx" ON "productos_tecnicos"("proyecto_id", "vigente");

-- ─── 6. Documentos firmables ────────────────────────────────────────────────
-- Ley 527/1999 y Decreto 2364/2012: la firma electrónica simple vale si se
-- prueba quién firmó, cuándo, y que el documento no cambió. La huella cubre lo
-- tercero; firmado_por_id y firmado_el, los dos primeros.
DO $$ BEGIN
  CREATE TYPE "TipoDocumentoFirmable" AS ENUM
    ('ACTA_ESTADO_INICIAL', 'INFORME_TECNICO', 'ACTA_DANOS', 'INFORME_GRIETAS', 'DERECHO_PETICION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "documentos_firmables" (
    "id"              TEXT NOT NULL,
    "folio"           TEXT NOT NULL,
    "hash"            TEXT NOT NULL,
    "tipo"            "TipoDocumentoFirmable" NOT NULL,
    "proyecto_id"     TEXT,
    "constructora_id" TEXT,
    "firmado_por_id"  TEXT,
    "firmado_el"      TIMESTAMP(3),
    "matricula"       TEXT,
    "recibido_por"    TEXT,
    "recibido_el"     TIMESTAMP(3),
    "version"         INTEGER NOT NULL DEFAULT 1,
    "reemplaza_a"     TEXT,
    "ciudad"          TEXT,
    "nivel"           TEXT,
    "piezas"          INTEGER,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentos_firmables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "documentos_firmables_folio_key"      ON "documentos_firmables"("folio");
CREATE INDEX        IF NOT EXISTS "documentos_firmables_created_at_idx" ON "documentos_firmables"("created_at");
CREATE INDEX        IF NOT EXISTS "documentos_firmables_ciudad_nivel_idx" ON "documentos_firmables"("ciudad", "nivel");
CREATE INDEX        IF NOT EXISTS "documentos_firmables_proyecto_id_idx"  ON "documentos_firmables"("proyecto_id");

-- ─── 7. Claves foráneas ─────────────────────────────────────────────────────
ALTER TABLE "productos_tecnicos"
  ADD CONSTRAINT "productos_tecnicos_proyecto_id_fkey"   FOREIGN KEY ("proyecto_id")   REFERENCES "proyectos"("id")         ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "productos_tecnicos_piso_id_fkey"       FOREIGN KEY ("piso_id")       REFERENCES "pisos"("id")             ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "productos_tecnicos_unidad_id_fkey"     FOREIGN KEY ("unidad_id")     REFERENCES "unidades"("id")          ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "productos_tecnicos_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id")          ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "productos_tecnicos_reemplaza_a_fkey"   FOREIGN KEY ("reemplaza_a")   REFERENCES "productos_tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documentos_firmables"
  ADD CONSTRAINT "documentos_firmables_proyecto_id_fkey"     FOREIGN KEY ("proyecto_id")     REFERENCES "proyectos"("id")            ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_firmables_constructora_id_fkey" FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id")        ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_firmables_firmado_por_id_fkey"  FOREIGN KEY ("firmado_por_id")  REFERENCES "usuarios"("id")             ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "documentos_firmables_reemplaza_a_fkey"     FOREIGN KEY ("reemplaza_a")     REFERENCES "documentos_firmables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 8. RLS — toda tabla nueva nace cerrada ─────────────────────────────────
-- Prisma se conecta como dueño y el dueño se salta sus propias políticas, así
-- que la aplicación sigue igual. Lo único que cambia es que la API pública de
-- Supabase deja de responder.
ALTER TABLE "productos_tecnicos"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documentos_firmables" ENABLE ROW LEVEL SECURITY;
