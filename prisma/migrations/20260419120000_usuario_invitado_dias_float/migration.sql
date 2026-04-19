-- Add invitado flag to usuarios (default true for backward compat)
ALTER TABLE "usuarios" ADD COLUMN "invitado" BOOLEAN NOT NULL DEFAULT true;

-- Change dias_habiles_semana from INT to FLOAT to support half-days (e.g. 5.5)
ALTER TABLE "proyectos" ALTER COLUMN "dias_habiles_semana" SET DATA TYPE DOUBLE PRECISION;
