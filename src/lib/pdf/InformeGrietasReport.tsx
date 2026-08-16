import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfStyles, pdfColors, formatDate } from "./styles";
import { evaluarInmueble } from "@/lib/alerta/reglas";
import { ADVERTENCIA_VERDE, LABEL_ELEMENTO } from "@/lib/alerta/copys";
import { AVISO_DOCUMENTO } from "@/lib/juntos/contenido-legal";
import type { IdentidadActa } from "@/lib/juntos/acta-juntos";
import type { InformeGrietasPayload } from "@/lib/alerta/grietas";
import type { Nivel } from "@/lib/alerta/tipos";

// Estilos propios del informe de grietas — se combinan con
// pdfStyles/pdfColors compartidos de styles.ts, que solo se CONSUMEN aquí,
// no se modifican (mismo criterio que ActaJuntosReport.tsx).
const informeStyles = StyleSheet.create({
  logo: {
    width: 34,
    height: 34,
    marginRight: 10,
  },
  headerIzq: {
    flexDirection: "row",
    alignItems: "center",
  },
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
  resumenNivel: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  advertenciaVerde: {
    fontSize: 8,
    color: "#166534",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 6,
    borderRadius: 4,
    marginTop: 6,
    lineHeight: 1.4,
  },
  grietaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  grietaTitulo: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
  },
  nivelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  discrepancia: {
    fontSize: 8,
    color: "#92400e",
    backgroundColor: "#fffbeb",
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
  },
  razon: {
    fontSize: 9,
    color: pdfColors.textMuted,
    marginBottom: 4,
  },
  queHacer: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: pdfColors.text,
    marginBottom: 4,
  },
  queNoHacerItem: {
    fontSize: 9,
    color: pdfColors.textMuted,
  },
  notaVisual: {
    fontSize: 8,
    color: pdfColors.textMuted,
    marginTop: 6,
    fontStyle: "italic",
  },
  fotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  foto: {
    width: 160,
    height: 120,
    borderRadius: 4,
    // "contain": la evidencia se ve completa, nunca recortada (spec Juntos).
    objectFit: "contain",
    backgroundColor: pdfColors.bgMuted,
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
  cierre: {
    fontSize: 8,
    color: pdfColors.textMuted,
    lineHeight: 1.5,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
  },
  footerDisclaimer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 6,
  },
  footerDisclaimerText: {
    fontSize: 7,
    color: pdfColors.textMuted,
    lineHeight: 1.3,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
});

const LABEL_NIVEL: Record<Nivel, string> = {
  rojo: "Riesgo alto",
  amarillo: "Necesita revisión",
  verde: "Sin señales de alarma",
};

/** Prioridad de revisión en lenguaje Juntos — acompaña al nivel, nunca lo reemplaza. */
const PRIORIDAD_NIVEL: Record<Nivel, string> = {
  rojo: "Revisión urgente",
  amarillo: "Revisión pronto",
  verde: "Revisión cuando puedas",
};

const COLOR_NIVEL: Record<Nivel, string> = {
  rojo: pdfColors.red,
  amarillo: pdfColors.yellow,
  verde: pdfColors.green,
};

export interface InformeGrietasReportProps {
  /**
   * El informe de Juntos (informe-juntos.ts, tras el gate de datos) trae
   * `identidad`. Sigue siendo opcional por herencia: el informe de Fase 2
   * (/api/alerta/informe-grietas-pdf) no la pedía, y esa ruta ya se borró por
   * huérfana. Hoy siempre llega — presente → se imprime «Quién declara».
   */
  data: InformeGrietasPayload & { identidad?: IdentidadActa };
  /** Folio JT- + hash de verificación (spec Juntos) — los calcula la ruta API. */
  folio?: string;
  hashCorto?: string;
  logoDataUrl?: string | null;
}

/**
 * Informe de grietas (/go/juntos/revisar). Cabecera Seiricon Juntos con logo
 * real, disclaimer arriba y en el pie de CADA página (`fixed`), folio + hash
 * de verificación, bloque de identidad del declarante (mismo del acta, cuando
 * el informe viene del gate de datos), nivel del inmueble (evaluarInmueble)
 * con su prioridad de revisión y, por grieta: nivel, elemento declarado vs.
 * final, razón, qué hacer / qué no hacer, ADVERTENCIA_VERDE cuando el nivel es
 * verde, y las dos fotos de evidencia con overlay en objectFit "contain".
 *
 * La identidad (nombre, cédula, WhatsApp, dirección, ciudad) SOLO existe en el
 * request y en este PDF: nunca se persiste (regla dura del spec).
 */
export function InformeGrietasReport({ data, folio, hashCorto, logoDataUrl = null }: InformeGrietasReportProps) {
  const hoy = new Date();
  const identidad = data.identidad;
  const veredictoInmueble = evaluarInmueble(data.grietas.map((g) => g.veredicto));

  return (
    <Document title="Informe de grietas — Seiricon Juntos" author="Seiricon" creator="Seiricon">
      <Page size="A4" style={[pdfStyles.page, { paddingBottom: 64 }]}>
        <View style={pdfStyles.header}>
          <View style={informeStyles.headerIzq}>
            {logoDataUrl && <Image src={logoDataUrl} style={informeStyles.logo} />}
            <View>
              <Text style={pdfStyles.brand}>SEIRICON</Text>
              <Text style={pdfStyles.tagline}>Juntos — línea de ayuda post-sismo</Text>
            </View>
          </View>
          <View style={pdfStyles.headerRight}>
            <Text style={pdfStyles.reportTitle}>Informe de grietas</Text>
            <Text style={pdfStyles.reportDate}>Generado el {formatDate(hoy)}</Text>
            {folio && <Text style={pdfStyles.reportDate}>Folio {folio}</Text>}
          </View>
        </View>

        <View style={informeStyles.disclaimer}>
          <Text style={informeStyles.disclaimerText}>
            Este documento es una lectura de fotos y respuestas de la persona reportante. NO constituye una
            evaluación de un ingeniero estructural ni un diagnóstico de habitabilidad.
          </Text>
        </View>

        {/* Bloque de identidad — mismo patrón y estilos que ActaJuntosReport.
            Solo aparece cuando el informe pasó por el gate de datos. */}
        {identidad && (
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
            </View>
          </View>
        )}

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Resultado general del inmueble</Text>
          <View style={[pdfStyles.card, { borderLeftWidth: 4, borderLeftColor: COLOR_NIVEL[veredictoInmueble.nivel] }]}>
            <Text style={pdfStyles.label}>Nivel (el peor de todas las grietas evaluadas)</Text>
            <Text style={[informeStyles.resumenNivel, { color: COLOR_NIVEL[veredictoInmueble.nivel] }]}>
              {LABEL_NIVEL[veredictoInmueble.nivel]} — {PRIORIDAD_NIVEL[veredictoInmueble.nivel]}
            </Text>
            <Text style={[pdfStyles.value, { fontSize: 10, fontFamily: "Helvetica" }]}>{veredictoInmueble.que_hacer}</Text>
            {veredictoInmueble.nivel === "verde" && (
              <Text style={informeStyles.advertenciaVerde}>{ADVERTENCIA_VERDE}</Text>
            )}
          </View>
        </View>

        {data.grietas.map((g, i) => (
          <View key={i} style={pdfStyles.section} wrap={false}>
            <View style={informeStyles.grietaHeader}>
              <Text style={informeStyles.grietaTitulo}>Grieta {i + 1}</Text>
              <Text style={[informeStyles.nivelBadge, { backgroundColor: COLOR_NIVEL[g.veredicto.nivel] }]}>
                {LABEL_NIVEL[g.veredicto.nivel]}
              </Text>
            </View>

            <View style={pdfStyles.row}>
              <View style={[pdfStyles.card, pdfStyles.col]}>
                <Text style={pdfStyles.label}>Elemento declarado</Text>
                <Text style={[pdfStyles.value, { fontSize: 11 }]}>{LABEL_ELEMENTO[g.elementoDeclarado]}</Text>
              </View>
              <View style={[pdfStyles.card, pdfStyles.col]}>
                <Text style={pdfStyles.label}>Elemento evaluado</Text>
                <Text style={[pdfStyles.value, { fontSize: 11 }]}>{LABEL_ELEMENTO[g.elementoFinal]}</Text>
              </View>
            </View>

            {g.hubo_discrepancia && (
              <Text style={informeStyles.discrepancia}>
                Lo que se declaró y lo que se ve en la foto no coinciden. Se usó la lectura más conservadora
                entre las dos.
              </Text>
            )}

            <Text style={informeStyles.razon}>{g.veredicto.razon}</Text>
            <Text style={informeStyles.queHacer}>{g.veredicto.que_hacer}</Text>
            {g.veredicto.que_no_hacer.length > 0 && (
              <View>
                {g.veredicto.que_no_hacer.map((item, j) => (
                  <Text key={j} style={informeStyles.queNoHacerItem}>
                    • {item}
                  </Text>
                ))}
              </View>
            )}
            {g.veredicto.nivel === "verde" && (
              <Text style={informeStyles.advertenciaVerde}>{ADVERTENCIA_VERDE}</Text>
            )}
            {g.notaVisual && <Text style={informeStyles.notaVisual}>Lo que se ve en la foto: {g.notaVisual}</Text>}

            <View style={informeStyles.fotoGrid}>
              {g.fotos.map((foto, j) => (
                <Image key={j} src={foto.dataUrl} style={informeStyles.foto} />
              ))}
            </View>
          </View>
        ))}

        <Text style={informeStyles.cierre}>{AVISO_DOCUMENTO}</Text>

        <View style={informeStyles.footerDisclaimer} fixed>
          <Text style={informeStyles.footerDisclaimerText}>
            Este documento es una lectura automatizada y NO constituye una evaluación de un ingeniero
            estructural ni un diagnóstico de habitabilidad.
          </Text>
          <View style={informeStyles.footerRow}>
            <Text style={pdfStyles.footerText}>
              Seiricon Juntos
              {folio && hashCorto
                ? ` · Verifica este documento en seiricon.com/go/juntos/verificar · Folio: ${folio} · Huella: ${hashCorto}`
                : " · seiricon.com/go/juntos"}
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
