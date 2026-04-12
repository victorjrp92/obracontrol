import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";

interface ContratistaTareasData {
  contratistaNombre: string;
  constructoraNombre: string;
  resumen: {
    total: number;
    aprobadas: number;
    reportadas: number;
    pendientes: number;
    noAprobadas: number;
    porcentajeAprobado: number;
  };
  tareas: {
    nombre: string;
    proyecto: string;
    ubicacion: string;
    estado: string;
    diasRestantes: number;
    semaforo: string;
  }[];
}

function estadoColor(estado: string): string {
  switch (estado) {
    case "APROBADA":
      return pdfColors.green;
    case "REPORTADA":
      return pdfColors.brand;
    case "NO_APROBADA":
      return pdfColors.red;
    default:
      return pdfColors.textMuted;
  }
}

function estadoLabel(estado: string): string {
  switch (estado) {
    case "APROBADA":
      return "Aprobada";
    case "REPORTADA":
      return "Reportada";
    case "NO_APROBADA":
      return "No aprobada";
    default:
      return "Pendiente";
  }
}

export function ContratistaTareasReport({ data }: { data: ContratistaTareasData }) {
  const hoy = new Date();
  const { resumen } = data;

  return (
    <Document
      title={`Reporte de tareas - ${data.contratistaNombre}`}
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
            <Text style={pdfStyles.reportTitle}>Reporte de tareas</Text>
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
              <Text style={pdfStyles.label}>Fecha de reporte</Text>
              <Text style={[pdfStyles.value, { fontSize: 11 }]}>{formatDate(hoy)}</Text>
            </View>
          </View>
        </View>

        {/* Progress summary */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Progreso general</Text>
          <View style={[pdfStyles.card, { marginBottom: 12 }]}>
            <Text style={pdfStyles.label}>Porcentaje aprobado</Text>
            <Text style={[pdfStyles.value, { color: pdfColors.brand, fontSize: 24 }]}>
              {resumen.porcentajeAprobado}%
            </Text>
            <View style={pdfStyles.progressBarTrack}>
              <View
                style={[pdfStyles.progressBarFill, { width: `${resumen.porcentajeAprobado}%` }]}
              />
            </View>
            <Text style={{ fontSize: 8, color: pdfColors.textMuted }}>
              {resumen.aprobadas} de {resumen.total} tareas aprobadas
            </Text>
          </View>
        </View>

        {/* Task stats */}
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Estado de tareas</Text>
          <View style={pdfStyles.row}>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Total</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.text }]}>{resumen.total}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col, { backgroundColor: "#f0fdf4" }]}>
              <Text style={pdfStyles.label}>Aprobadas</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.green }]}>{resumen.aprobadas}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col, { backgroundColor: "#eff6ff" }]}>
              <Text style={pdfStyles.label}>Reportadas</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.brand }]}>{resumen.reportadas}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col]}>
              <Text style={pdfStyles.label}>Pendientes</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.textMuted }]}>{resumen.pendientes}</Text>
            </View>
            <View style={[pdfStyles.card, pdfStyles.col, { backgroundColor: "#fef2f2" }]}>
              <Text style={pdfStyles.label}>No aprobadas</Text>
              <Text style={[pdfStyles.value, { color: pdfColors.red }]}>{resumen.noAprobadas}</Text>
            </View>
          </View>
        </View>

        {/* Tasks table */}
        {data.tareas.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Detalle de tareas</Text>
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.tableHeaderText, { flex: 3 }]}>Tarea</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 2 }]}>Proyecto</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 2 }]}>Ubicación</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 1.5, textAlign: "center" }]}>Estado</Text>
                <Text style={[pdfStyles.tableHeaderText, { flex: 1, textAlign: "center" }]}>Días</Text>
              </View>
              {data.tareas.map((t, i) => (
                <View
                  key={i}
                  style={i === data.tareas.length - 1 ? pdfStyles.tableRowLast : pdfStyles.tableRow}
                >
                  <Text style={[pdfStyles.tableCell, { flex: 3, fontFamily: "Helvetica-Bold" }]}>
                    {t.nombre}
                  </Text>
                  <Text style={[pdfStyles.tableCell, { flex: 2 }]}>{t.proyecto}</Text>
                  <Text style={[pdfStyles.tableCell, { flex: 2, color: pdfColors.textMuted }]}>
                    {t.ubicacion}
                  </Text>
                  <Text
                    style={[
                      pdfStyles.tableCell,
                      { flex: 1.5, textAlign: "center", color: estadoColor(t.estado), fontFamily: "Helvetica-Bold" },
                    ]}
                  >
                    {estadoLabel(t.estado)}
                  </Text>
                  <Text
                    style={[
                      pdfStyles.tableCell,
                      {
                        flex: 1,
                        textAlign: "center",
                        color: t.diasRestantes < 0 ? pdfColors.red : pdfColors.textMuted,
                      },
                    ]}
                  >
                    {t.diasRestantes >= 0 ? `+${t.diasRestantes}d` : `${t.diasRestantes}d`}
                  </Text>
                </View>
              ))}
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
