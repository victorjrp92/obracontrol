-- "¿Cómo controlas hoy el trabajo?" pasa de selección única a MÚLTIPLE.
-- control_actual: String? → String[] (array de valores de la allowlist nueva:
--   WHATSAPP_FOTOS | EXCEL | CUADERNO | OTRA_APP | SIN_CONTROL).
-- control_otra: texto libre del "¿cuál?" cuando incluye OTRA_APP (≤80).
-- La tabla perfil_onboarding es nueva (datos mínimos), así que se puede
-- reemplazar la columna de forma segura.

-- AlterTable
ALTER TABLE "perfil_onboarding" DROP COLUMN "control_actual";
ALTER TABLE "perfil_onboarding" ADD COLUMN "control_actual" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "perfil_onboarding" ADD COLUMN "control_otra" TEXT;
