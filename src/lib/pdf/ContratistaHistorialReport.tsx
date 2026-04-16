import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate, formatDateShort } from "./styles";

interface ContratistaHistorialData {
  contratistaNombre: string;
  constructoraNombre: string;
  historial: {
    tareaNombre: string;
    proyecto: string;
    ubicacion: string;
    fecha: Date;
    estado: string;
    justificacion?: string;
    aprobadorNombre: string;
  }[];
}

export function ContratistaHistorialReport({ data }: { data: ContratistaHistorialData }) {
  const hoy = new Date();

  return (
    <Document
      title={`Historial de aprobaciones - ${data.contratistaNombre}`}
      author="Seiricon"
      creator="Seiricon"
    >
      <Page size="A4" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.brand}>SEIRICON</Text>
            <Text style={pdfStyles.tagline}>construyendo en orden</Text>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>Historial de aprobaciones</Text>
            <Text style={pdfStyles.reportDate}>Generado el {formatDate(hoy)}</Text>
          </View>
        </View>

        {/* Contratista info */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{data.contratistaNombre}</Text>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Constructora</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{data.constructoraNombre}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Total registros</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{data.historial.length}</Text>
            </View>
          </View>
        </View>

        {/* Historial table */}
        {data.historial.length > 0 ? (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Registro de decisiones</Text>
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.tableHeaderText, { flex: 3 }]}>Tarea</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 2 }]}>Proyecto / Ubicación</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 1.5, textAlign: "center" }]}>Fecha</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 1.5, textAlign: "center" }]}>Estado</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 2 }]}>Aprobador</Text>
              </View>
              {data.historial.map((h, i) => {
                const isAprobada = h.estado === "APROBADA";
                return (
                  <View key={i} wrap={false}>
                    <View
                      style={
                        i === data.historial.length - 1 && !h.justificacion
                          ? pdfStyles.tableRowLast
                          : pdfStyles.tableRow
                      }
                    >
                      <Text style={[pdfStyles.tableCell, { flex: 3, fontFamily: "Helvetica-Bold" }]}>
                        {h.tareaNombre}
                      </Text>
                      <Text style={[pdfStyles.tableCell, { flex: 2, color: pdfColors.textMuted }]}>
                        {h.proyecto}{"\n"}{h.ubicacion}
                      </Text>
                      <Text style={[pdfStyles.tableCell, { flex: 1.5, textAlign: "center", color: pdfColors.textMuted }]}>
                        {formatDateShort(h.fecha)}
                      </Text>
                      <Text
                        style={[
                          pdfStyles.tableCell,
                          {
                            flex: 1.5,
                            textAlign: "center",
                            fontFamily: "Helvetica-Bold",
                            color: isAprobada ? pdfColors.green : pdfColors.red,
                          },
                        ]}
                      >
                        {isAprobada ? "Aprobada" : "No aprobada"}
                      </Text>
                      <Text style={[pdfStyles.tableCell, { flex: 2 }]}>{h.aprobadorNombre}</Text>
                    </View>
                    {h.justificacion && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingBottom: 6,
                          borderBottomWidth: i === data.historial.length - 1 ? 0 : 1,
                          borderBottomColor: pdfColors.border,
                        }}
                      >
                        <Text style={{ fontSize: 8, color: pdfColors.red, fontFamily: "Helvetica-Bold" }}>
                          Motivo: {h.justificacion}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={pdfStyles.section}>
            <View style={pdfStyles.card}>
              <Text style={{ fontSize: 10, color: pdfColors.textMuted, textAlign: "center" }}>
                Sin historial de aprobaciones registrado
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={pdfStyles.footer} fixed>
          <Text style={pdfStyles.footerText}>Seiricon · seiricon.com</Text>
          <Text
            style={pdfStyles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
