ALTER TABLE "constructoras" ALTER COLUMN "nit" DROP NOT NULL;
ALTER TABLE "constructoras" ADD COLUMN IF NOT EXISTS "direccion" TEXT;
ALTER TABLE "constructoras" ADD COLUMN IF NOT EXISTS "ciudad" TEXT;
ALTER TABLE "constructoras" ADD COLUMN IF NOT EXISTS "telefono" TEXT;
ALTER TABLE "constructoras" ADD COLUMN IF NOT EXISTS "sitio_web" TEXT;
ALTER TABLE "constructoras" ADD COLUMN IF NOT EXISTS "descripcion" TEXT;
