-- ════════════════════════════════════════════════════════════════════════════
-- Suscripciones y cobros — conectar el plan de negocio al producto
-- ════════════════════════════════════════════════════════════════════════════
--
-- Antes de esto, `constructoras.plan_suscripcion` era un enum decorativo: nadie
-- verificaba vigencia, no había forma de cobrar y el registro creaba cada cuenta
-- en PROYECTO (el plan de $1.500.000/mes) sin vencimiento. Producto completo,
-- gratis y para siempre.
--
-- Se añaden: el estado de la suscripción en `constructoras` y la tabla
-- `pagos_suscripcion`, que es el historial de cobros y la llave de idempotencia
-- del webhook de Wompi.
--
-- ⚠️ CUENTAS EXISTENTES: al final se les da vigencia hasta dentro de 30 días en
--    vez de dejarlas vencidas. Cortarle el acceso de golpe a quien ya está
--    usando el producto sería la peor forma de estrenar el cobro. Ajusta ese
--    plazo si prefieres otro, pero decide a conciencia — es dinero y es
--    relación con clientes.

-- ─── 1. Estado de la suscripción ────────────────────────────────────────────

CREATE TYPE "EstadoSuscripcion" AS ENUM ('PRUEBA', 'ACTIVA', 'VENCIDA', 'CANCELADA');

ALTER TABLE "constructoras"
  ADD COLUMN "estado_suscripcion"    "EstadoSuscripcion" NOT NULL DEFAULT 'PRUEBA',
  ADD COLUMN "suscripcion_vence_el"  TIMESTAMP(3),
  ADD COLUMN "renovacion_automatica" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "wompi_fuente_pago_id"  TEXT;

-- ─── 2. Historial de cobros ─────────────────────────────────────────────────

CREATE TYPE "EstadoPagoSuscripcion" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO', 'ERROR');

CREATE TABLE "pagos_suscripcion" (
    "id"                   TEXT NOT NULL,
    "constructora_id"      TEXT NOT NULL,
    "referencia"           TEXT NOT NULL,
    "wompi_transaccion_id" TEXT,
    "plan"                 "PlanTipo" NOT NULL,
    "periodo_meses"        INTEGER NOT NULL DEFAULT 1,
    "monto_centavos"       INTEGER NOT NULL,
    "moneda"               TEXT NOT NULL DEFAULT 'COP',
    "metodo"               TEXT,
    "estado"               "EstadoPagoSuscripcion" NOT NULL DEFAULT 'PENDIENTE',
    "cubre_desde"          TIMESTAMP(3),
    "cubre_hasta"          TIMESTAMP(3),
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_suscripcion_pkey" PRIMARY KEY ("id")
);

-- `referencia` única: es lo que hace idempotente al webhook. Wompi reintenta los
-- eventos, y sin esto un reintento extendería la vigencia dos veces.
CREATE UNIQUE INDEX "pagos_suscripcion_referencia_key" ON "pagos_suscripcion"("referencia");
CREATE UNIQUE INDEX "pagos_suscripcion_wompi_transaccion_id_key" ON "pagos_suscripcion"("wompi_transaccion_id");
CREATE INDEX "pagos_suscripcion_constructora_id_created_at_idx" ON "pagos_suscripcion"("constructora_id", "created_at");
CREATE INDEX "pagos_suscripcion_estado_idx" ON "pagos_suscripcion"("estado");

ALTER TABLE "pagos_suscripcion"
  ADD CONSTRAINT "pagos_suscripcion_constructora_id_fkey"
  FOREIGN KEY ("constructora_id") REFERENCES "constructoras"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS, igual que `contacto_juntos`: la tabla guarda montos y referencias de pago
-- y no tiene por qué ser legible desde la API pública de Supabase.
ALTER TABLE "pagos_suscripcion" ENABLE ROW LEVEL SECURITY;

-- ─── 3. Cuentas que ya existen ──────────────────────────────────────────────
-- Se les da 30 días de gracia desde hoy. Las cuentas PERSONAL no vencen nunca
-- (su límite es por número de obras, no por tiempo), así que se dejan sin fecha.

UPDATE "constructoras"
SET "estado_suscripcion"   = 'ACTIVA',
    "suscripcion_vence_el" = CURRENT_TIMESTAMP + INTERVAL '30 days'
WHERE "plan_suscripcion" <> 'PERSONAL';

UPDATE "constructoras"
SET "estado_suscripcion"   = 'ACTIVA',
    "suscripcion_vence_el" = NULL
WHERE "plan_suscripcion" = 'PERSONAL';
