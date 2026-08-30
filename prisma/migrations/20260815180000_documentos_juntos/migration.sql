-- ════════════════════════════════════════════════════════════════════════════
-- Registro de verificación de los documentos de «Juntos»
-- ════════════════════════════════════════════════════════════════════════════
--
-- Cada PDF imprime en el pie «Verificación: <folio> · <hash-corto>». Hasta ahora
-- ese sello era decorativo: folio y hash se calculaban al generar el documento y
-- no se guardaban en ninguna parte, así que si una aseguradora preguntaba «¿este
-- acta es suya?», no había contra qué cotejarlo. El producto prometía una
-- verificación que no podía cumplir.
--
-- QUÉ ENTRA AQUÍ: folio, huella, tipo, ciudad, nivel del semáforo y número de
-- piezas. Nada de eso identifica a una persona.
--
-- QUÉ NO ENTRA, Y NO DEBE ENTRAR NUNCA: nombre, cédula, dirección, teléfono ni
-- fotos. La cédula y la dirección tienen una promesa explícita en pantalla; las
-- fotos son el interior de la casa de alguien. Guardar fotos exigiría un
-- consentimiento aparte, con su finalidad y su plazo de retención — es una
-- decisión de negocio, no un cambio de esquema.

CREATE TYPE "TipoDocumentoJuntos" AS ENUM ('ACTA', 'INFORME', 'PETICION');

CREATE TABLE "documentos_juntos" (
    "id"         TEXT NOT NULL,
    "folio"      TEXT NOT NULL,
    "hash"       TEXT NOT NULL,
    "tipo"       "TipoDocumentoJuntos" NOT NULL,
    "ciudad"     TEXT,
    "nivel"      TEXT,
    "piezas"     INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_juntos_pkey" PRIMARY KEY ("id")
);

-- El folio es la llave de búsqueda de la verificación: único e indexado.
CREATE UNIQUE INDEX "documentos_juntos_folio_key" ON "documentos_juntos"("folio");
CREATE INDEX "documentos_juntos_created_at_idx" ON "documentos_juntos"("created_at");
-- Para el agregado por ciudad y severidad (el insumo del censo del RUD).
CREATE INDEX "documentos_juntos_ciudad_nivel_idx" ON "documentos_juntos"("ciudad", "nivel");

-- RLS, igual que `contacto_juntos` y `pagos_suscripcion`: aunque no haya datos
-- personales, esta tabla revela volúmenes de negocio y no tiene por qué ser
-- legible desde la API pública de Supabase.
ALTER TABLE "documentos_juntos" ENABLE ROW LEVEL SECURITY;
