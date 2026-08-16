import { prisma } from "@/lib/prisma";
import type { TipoDocumentoJuntos } from "@/generated/prisma";

/**
 * Registro de verificación de los documentos de «Juntos».
 *
 * Cada PDF imprime «Verificación: <folio> · <hash-corto>» en el pie. Este módulo
 * es lo que hace que ese sello signifique algo: guarda el folio y la huella para
 * poder confirmar después que un documento salió de aquí.
 *
 * REGLA DURA, la misma de siempre: aquí NO entra nada que identifique a una
 * persona. Ni nombre, ni cédula, ni dirección, ni teléfono, ni fotos. Solo el
 * folio, la huella, el tipo, la ciudad y el nivel del semáforo. Si alguna vez se
 * quiere guardar más, necesita consentimiento aparte con su finalidad y su
 * plazo — no se cuela por aquí.
 *
 * El registro es BEST-EFFORT: si falla, el documento se entrega igual. Nadie que
 * acaba de documentar los daños de su casa después de un sismo debe quedarse sin
 * su PDF porque nuestra base de datos tuvo un mal minuto. Se pierde la
 * verificación de ese documento, que es un costo mucho menor.
 */

export interface RegistroDocumento {
  folio: string;
  /** SHA-256 completo. En el PDF se imprime corto, pero se guarda entero. */
  hash: string;
  tipo: TipoDocumentoJuntos;
  ciudad?: string | null;
  /** Peor nivel del semáforo. Solo aplica a informes de grietas. */
  nivel?: string | null;
  /** Cuántas grietas o espacios trae el documento. */
  piezas?: number | null;
}

/** Normaliza la ciudad para que el agregado por ciudad no se parta en variantes. */
function normalizarCiudad(ciudad: string | null | undefined): string | null {
  if (!ciudad) return null;
  const limpia = ciudad.trim().slice(0, 60);
  return limpia.length >= 2 ? limpia : null;
}

/**
 * Deja constancia de un documento emitido. Nunca lanza: quien la llama ya
 * generó el PDF y debe entregarlo pase lo que pase.
 */
export async function registrarDocumento(datos: RegistroDocumento): Promise<void> {
  try {
    await prisma.documentoJuntos.create({
      data: {
        folio: datos.folio,
        hash: datos.hash,
        tipo: datos.tipo,
        ciudad: normalizarCiudad(datos.ciudad),
        nivel: datos.nivel ?? null,
        piezas: datos.piezas ?? null,
      },
    });
  } catch {
    // Sin serializar nada: por estas rutas viajan cédula y fotos.
    console.error("registrarDocumento: no se pudo dejar constancia del documento");
  }
}

export type ResultadoVerificacion =
  | { existe: false }
  | {
      existe: true;
      tipo: TipoDocumentoJuntos;
      emitido: string;
      /** `null` si quien consulta no mandó huella para cotejar. */
      huellaCoincide: boolean | null;
    };

/**
 * Comprueba un folio y, si se aporta, su huella.
 *
 * Devuelve DELIBERADAMENTE poco: que el documento existe, de qué tipo es, cuándo
 * se emitió y si la huella coincide. Nada más. Quien consulta suele ser una
 * aseguradora con el PDF en la mano, y le basta con saber que es auténtico — no
 * necesita, ni debe recibir, el contenido. Como el folio viaja impreso en el
 * documento, cualquiera que lo tenga podría consultarlo: por eso la respuesta no
 * puede revelar nada que el PDF no muestre ya.
 */
export async function verificarDocumento(
  folio: string,
  huella?: string | null
): Promise<ResultadoVerificacion> {
  const doc = await prisma.documentoJuntos.findUnique({
    where: { folio },
    select: { tipo: true, hash: true, created_at: true },
  });
  if (!doc) return { existe: false };

  let huellaCoincide: boolean | null = null;
  if (huella) {
    const limpia = huella.trim().toLowerCase();
    // Se acepta la huella corta (la que se imprime) o la completa.
    huellaCoincide = doc.hash.toLowerCase().startsWith(limpia) && limpia.length >= 8;
  }

  return {
    existe: true,
    tipo: doc.tipo,
    emitido: doc.created_at.toISOString().slice(0, 10),
    huellaCoincide,
  };
}
