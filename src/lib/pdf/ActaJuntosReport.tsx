import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";
import { AVISO_DOCUMENTO } from "@/lib/juntos/contenido-legal";
import type { ActaJuntosPayload } from "@/lib/juntos/acta-juntos";

/**
 * Acta de documentación de daños — línea «Juntos» (/go/juntos/documentar).
 * Adaptada de ActaDanosReport.tsx (Fase 1) según spec-go-juntos.md:
 * logo real, bloque de identidad del declarante, folio + hash de verificación
 * en el pie de CADA página, resumen de daños al inicio (pensado para el RUD),
 * fotos con objectFit "contain" (la evidencia no se recorta) y párrafo sobrio
 * final con el aviso canónico (AVISO_DOCUMENTO).
 *
 * La identidad (nombre, cédula, WhatsApp, dirección, ciudad) SOLO existe en
 * el request y en este PDF: nunca se persiste (regla dura del spec).
 */

const actaStyles = StyleSheet.create({
  logo: {
    width: 34,
    height: 34,
    marginRight: 10,
  },
  headerIzq: {
    flexDirection: "row",
    alignItems: "center",
  },
  aviso: {
    padding: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: 16,
  },
  avisoText: {
    fontSize: 8,
    color: "#92400e",
    lineHeight: 1.4,
  },
  resumenFila: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
    paddingVertical: 5,
    gap: 8,
  },
  resumenEspacio: {
    width: 130,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
  },
  resumenDetalle: {
    flex: 1,
    fontSize: 9,
    color: pdfColors.textMuted,
  },
  espacioTitulo: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginBottom: 4,
  },
  espacioNota: {
    fontSize: 9,
    color: pdfColors.textMuted,
    marginBottom: 8,
  },
  fotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  foto: {
    width: 160,
    height: 120,
    borderRadius: 4,
    // "contain": la evidencia se ve completa, nunca recortada (spec).
    objectFit: "contain",
    backgroundColor: pdfColors.bgMuted,
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
  declaracion: {
    fontSize: 9,
    color: pdfColors.text,
    lineHeight: 1.5,
    marginBottom: 18,
  },
  firmaLinea: {
    width: 220,
    borderTopWidth: 1,
    borderTopColor: pdfColors.text,
    paddingTop: 4,
    marginTop: 34,
  },
  firmaNombre: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
  },
  firmaDetalle: {
    fontSize: 8,
    color: pdfColors.textMuted,
    marginTop: 1,
  },
  cierre: {
    fontSize: 8,
    color: pdfColors.textMuted,
    lineHeight: 1.5,
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
  },
  footerFijo: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
  },
  footerDisclaimer: {
    fontSize: 7,
    color: pdfColors.textMuted,
    lineHeight: 1.3,
  },
  footerFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
});

const LABEL_TIPO_INMUEBLE: Record<ActaJuntosPayload["inmueble"]["tipo"], string> = {
  CASA: "Casa",
  APARTAMENTO: "Apartamento",
  EDIFICIO: "Edificio",
  LOCAL: "Local",
};

/** Una línea, pie de CADA página (patrón InformeGrietasReport). */
const DISCLAIMER_PIE =
  "Registro de daños declarados por quien genera el documento. No es un peritaje ni un dictamen técnico: la evaluación técnica la realizan un ingeniero estructural o los organismos oficiales.";

export interface ActaJuntosReportProps {
  data: ActaJuntosPayload;
  folio: string;
  hashCorto: string;
  /** Data-URI del logo (logoSeiriconDataUrl) — null cae al wordmark de texto. */
  logoDataUrl: string | null;
}

export function ActaJuntosReport({ data, folio, hashCorto, logoDataUrl }: ActaJuntosReportProps) {
  const hoy = new Date();
  const { identidad } = data;
  const totalFotos = data.espacios.reduce((acc, e) => acc + e.fotos.length, 0);

  return (
    <Document title="Acta de documentación de daños — Seiricon Juntos" author="Seiricon" creator="Seiricon">
      <Page size="A4" style={[pdfStyles.page, { paddingBottom: 64 }]}>
        <View style={pdfStyles.header}>
          <View style={actaStyles.headerIzq}>
            {logoDataUrl && <Image src={logoDataUrl} style={actaStyles.logo} />}
            <View>
              <Text style={pdfStyles.brand}>SEIRICON</Text>
              <Text style={pdfStyles.tagline}>Juntos — línea de ayuda post-sismo</Text>
            </View>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>Acta de documentación de daños</Text>
            <Text style={pdfStyles.reportDate}>Generada el {formatDate(hoy)}</Text>
            <Text style={pdfStyles.reportDate}>Folio {folio}</Text>
          </View>
        </View>

        <View style={actaStyles.aviso}>
          <Text style={actaStyles.avisoText}>{AVISO_DOCUMENTO}</Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Quién declara</Text>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, { flex: 2 }]}>
              <Text style={pdfStyles.label}>Nombre</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{identidad.nombre}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Cédula</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{identidad.cedula}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>WhatsApp</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{identidad.whatsapp}</Text>
            </View>
          </View>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, { flex: 2 }]}>
              <Text style={pdfStyles.label}>Dirección del inmueble (ubicación del daño)</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{identidad.direccion}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Ciudad</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{identidad.ciudad}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Tipo de inmueble</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{LABEL_TIPO_INMUEBLE[data.inmueble.tipo]}</Text>
            </View>
          </View>
        </View>

        {/* Resumen inicial pensado para el registro de damnificados (RUD):
            qué se dañó, espacio por espacio, en una sola vista. */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>
            Resumen de daños declarados ({data.espacios.length} espacio{data.espacios.length !== 1 ? "s" : ""} ·{" "}
            {totalFotos} foto{totalFotos !== 1 ? "s" : ""})
          </Text>
          {data.espacios.map((espacio, i) => (
            <View key={i} style={actaStyles.resumenFila}>
              <Text style={actaStyles.resumenEspacio}>
                {i + 1}. {espacio.nombre}
              </Text>
              <Text style={actaStyles.resumenDetalle}>
                {espacio.nota ?? "Daños registrados en fotografías (ver inventario)."}
              </Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Inventario fotográfico por espacio</Text>
        </View>

        {data.espacios.map((espacio, i) => (
          <View key={i} style={pdfStyles.section} wrap={false}>
            <Text style={actaStyles.espacioTitulo}>
              {i + 1}. {espacio.nombre}
            </Text>
            {espacio.nota && <Text style={actaStyles.espacioNota}>Pérdidas declaradas: {espacio.nota}</Text>}
            <View style={actaStyles.fotoGrid}>
              {espacio.fotos.map((foto, j) => (
                <Image key={j} src={foto.dataUrl} style={actaStyles.foto} />
              ))}
            </View>
          </View>
        ))}

        <View wrap={false}>
          <Text style={actaStyles.declaracion}>
            Declaro que las fotografías y descripciones contenidas en este documento corresponden a los daños que
            observé en el inmueble identificado arriba, y que la fecha, hora y ubicación impresas en cada fotografía
            fueron registradas al momento de la captura.
          </Text>
          <View style={actaStyles.firmaLinea}>
            <Text style={actaStyles.firmaNombre}>{identidad.nombre}</Text>
            <Text style={actaStyles.firmaDetalle}>C.C. {identidad.cedula} · Firma del declarante</Text>
          </View>
          <Text style={actaStyles.cierre}>{AVISO_DOCUMENTO}</Text>
        </View>

        <View style={actaStyles.footerFijo} fixed>
          <Text style={actaStyles.footerDisclaimer}>{DISCLAIMER_PIE}</Text>
          <View style={actaStyles.footerFila}>
            <Text style={pdfStyles.footerText}>
              Seiricon Juntos · Verifica este documento en seiricon.com/go/juntos/verificar · Folio: {folio} · Huella: {hashCorto}
            </Text>
            <Text
              style={pdfStyles.footerText}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
