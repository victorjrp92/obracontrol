-- Renombre del valor del enum TipoCuenta: ARQUITECTO → CONTRATISTA (Contratista B2C).
--
-- Seguro y no destructivo: ALTER TYPE ... RENAME VALUE renombra el label del enum
-- en sitio. Las filas existentes en "constructoras"."tipo_cuenta" que apuntaban a
-- 'ARQUITECTO' quedan automáticamente mapeadas a 'CONTRATISTA' (no hay drop/recreate,
-- no se pierden datos, no se reordena el enum).
--
-- El tipo enum en Postgres se llama "TipoCuenta" (mapeo por defecto de Prisma,
-- el enum no tiene @@map en schema.prisma).
ALTER TYPE "TipoCuenta" RENAME VALUE 'ARQUITECTO' TO 'CONTRATISTA';
