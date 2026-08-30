import { NextRequest, NextResponse } from "next/server";
import {
  esFolioDeFamilia,
  normalizarFolio,
  verificarDocumento,
  PATRON_HUELLA,
  type PrefijoFolio,
} from "@/lib/documentos";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/rate-limit";

/**
 * GET /api/documentos/verificar?folio=AE-20260830-a3f9c1&huella=a1b2c3d4e5f6
 *
 * Comprueba un documento del profesional. Público y sin sesión: quien consulta
 * suele ser una aseguradora, un juzgado o el cliente, con el PDF en la mano.
 *
 * Responde tres cosas y ninguna más: que el documento existe y de qué tipo es,
 * si el CONTENIDO cambió (cotejando la huella impresa en el pie), y las dos
 * firmas —cuándo firmó el profesional, bajo qué matrícula, y si el cliente dejó
 * constancia de haberlo recibido—. Sin nombres: van impresos en el documento y
 * entran en la huella, así que si la huella coteja ya están probados, y
 * republicarlos aquí solo expondría a dos personas ante cualquiera que acierte
 * un folio.
 *
 * Responde SOLO por los folios del profesional. Los de la línea Juntos tienen su
 * propia pantalla y su propia ruta: mezclarlas filtraría documentos de un
 * producto en la consulta de otro.
 */

const MAX_POR_MINUTO_POR_IP = 20;

/** AE — acta de estado inicial · CT — concepto técnico. */
const PREFIJOS_PROFESIONAL: readonly PrefijoFolio[] = ["AE", "CT"];

export async function GET(req: NextRequest) {
  try {
    if (
      !permitirPeticion(
        `documentos-verificar:${claveDesdeHeaders(req.headers)}`,
        MAX_POR_MINUTO_POR_IP
      )
    ) {
      return NextResponse.json(
        { error: "Demasiadas consultas. Espera un minuto e intenta de nuevo." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const folio = normalizarFolio(searchParams.get("folio") ?? "");
    const huellaCruda = (searchParams.get("huella") ?? "").trim().toLowerCase();

    if (!esFolioDeFamilia(folio, PREFIJOS_PROFESIONAL)) {
      return NextResponse.json(
        { error: "El folio no tiene el formato esperado. Cópialo del pie de tu documento." },
        { status: 400 }
      );
    }

    // Una huella con formato raro se ignora en vez de tumbar la consulta: el
    // folio por sí solo ya es una verificación válida.
    const huella = PATRON_HUELLA.test(huellaCruda) ? huellaCruda : null;

    return NextResponse.json(await verificarDocumento(folio, huella));
  } catch {
    console.error("GET /api/documentos/verificar: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
