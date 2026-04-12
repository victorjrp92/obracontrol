-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_rol_id_fkey";

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "rol",
ALTER COLUMN "rol_id" SET NOT NULL;

-- DropEnum
DROP TYPE "RolUsuario";

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
