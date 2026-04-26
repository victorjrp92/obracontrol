import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// En local cargamos .env.local; en Vercel los env vars vienen inyectados
// directamente, así que dotenv simplemente no encuentra el archivo y no falla.
config({ path: ".env.local" });

// `prisma generate` no necesita conectarse a la BD, pero sí valida que `url`
// sea string. Usamos un placeholder cuando no está definido (típico durante el
// build de CI) para que `generate` corra; en runtime el cliente real lee de
// process.env.DATABASE_URL vía Prisma adapter.
const datasourceUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});
