-- La construcción colombiana trabaja de lunes a sábado. El default de 5 venía
-- de la plantilla de Prisma, no de una decisión: producía un sesgo sistemático
-- del 20% en toda fecha estimada.
--
-- Solo cambia el DEFAULT. Los proyectos existentes conservan su valor: cambiarles
-- el calendario a mitad de obra movería fechas que alguien ya acordó con su
-- cliente.
ALTER TABLE "proyectos" ALTER COLUMN "dias_habiles_semana" SET DEFAULT 6;
