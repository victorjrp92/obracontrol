import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";
import type { ActaPayload } from "@/lib/alerta/acta";

// Estilos propios del Acta de daños (grilla de fotos, disclaimer) — se
// combinan con `pdfStyles`/`pdfColors` compartidos de styles.ts, que solo se
// CONSUMEN aquí, no se modifican.
const actaStyles = StyleSheet.create({
  disclaimer: {
    padding: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 8,
    color: "#92400e",
    lineHeight: 1.4,
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
    objectFit: "cover",
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
});

const LABEL_TIPO_INMUEBLE: Record<ActaPayload["inmueble"]["tipo"], string> = {
  CASA: "Casa",
  APARTAMENTO: "Apartamento",
  EDIFICIO: "Edificio",
  LOCAL: "Local",
};

export function ActaDanosReport({ data }: { data: ActaPayload }) {
  const hoy = new Date();
  const totalFotos = data.espacios.reduce((acc, e) => acc + e.fotos.length, 0);

  return (
    <Document title="Acta de daños — Seiricon Alerta" author="Seiricon" creator="Seiricon">
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.brand}>SEIRICON</Text>
            <Text style={pdfStyles.tagline}>Seiricon Alerta</Text>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>Acta de daños</Text>
            <Text style={pdfStyles.reportDate}>Generada el {formatDate(hoy)}</Text>
          </View>
        </View>

        <View style={actaStyles.disclaimer}>
          <Text style={actaStyles.disclaimerText}>
            Este documento es una evidencia fotográfica autogenerada por la persona reportante. NO
            constituye una evaluación de un ingeniero estructural ni un diagnóstico de habitabilidad.
          </Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Inmueble</Text>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Tipo</Text>
              <Text style={[pdfStyles.value, { fontSize: 12 }]}>{LABEL_TIPO_INMUEBLE[data.inmueble.tipo]}</Text>
            </View>
            <View style={[pdfStyles.card, { flex: 2 }]}>
              <Text style={pdfStyles.label}>Dirección / descripción</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{data.inmueble.descripcion}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Espacios / fotos</Text>
              <Text style={[pdfStyles.value, { fontSize: 12 }]}>
                {data.espacios.length} / {totalFotos}
              </Text>
            </View>
          </View>
        </View>

        {data.espacios.map((espacio, i) => (
          <View key={i} style={pdfStyles.section} wrap={false}>
            <Text style={actaStyles.espacioTitulo}>
              {i + 1}. {espacio.nombre}
            </Text>
            {espacio.nota && <Text style={actaStyles.espacioNota}>{espacio.nota}</Text>}
            <View style={actaStyles.fotoGrid}>
              {espacio.fotos.map((foto, j) => (
                <Image key={j} src={foto.dataUrl} style={actaStyles.foto} />
              ))}
            </View>
          </View>
        ))}

        <View style={pdfStyles.footer} fixed>
          <Text style={pdfStyles.footerText}>Seiricon Alerta · seiricon.com/alerta</Text>
          <Text
            style={pdfStyles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
