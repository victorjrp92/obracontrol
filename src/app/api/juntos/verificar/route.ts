import { NextRequest, NextResponse } from "next/server";
import { normalizarFolio, esFolioDeFamilia, PATRON_HUELLA, type PrefijoFolio } from "@/lib/documentos";
import { verificarDocumento } from "@/lib/juntos/registro-documento";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/rate-limit";

/**
 * GET /api/juntos/verificar?folio=JT-20260815-a3f9c1&huella=a1b2c3d4e5f6
 *
 * Confirma que un documento de «Juntos» salió de aquí. Público y sin auth: quien
 * consulta suele ser una aseguradora o una alcaldía con el PDF en la mano, y no
 * tiene por qué tener cuenta.
 *
 * Devuelve deliberadamente poco —existe, tipo, fecha y si la huella coincide— y
 * nunca nada que el propio PDF no muestre ya. Como el folio viaja impreso en el
 * documento, hay que asumir que cualquiera que lo tenga puede consultarlo.
 *
 * El folio no es adivinable por fuerza bruta útil: la parte aleatoria son 3
 * bytes, así que probar folios al azar solo diría si existe un documento de esa
 * fecha, sin revelar de quién ni de qué. Aun así lleva rate limit, porque un
 * escaneo masivo permitiría estimar volúmenes y no hay razón para regalar eso.
 *
 * Esta ruta responde SOLO por los folios de Juntos. El formato y la
 * normalización los pone el módulo compartido de documentos; los prefijos, esta
 * línea.
 */

const MAX_POR_MINUTO_POR_IP = 20;
const PREFIJOS_JUNTOS: readonly PrefijoFolio[] = ["JT", "DP"];

export async function GET(req: NextRequest) {
  try {
    if (!permitirPeticion(`juntos-verificar:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
      return NextResponse.json(
        { error: "Demasiadas consultas. Espera un minuto e intenta de nuevo." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const folio = normalizarFolio(searchParams.get("folio") ?? "");
    const huellaCruda = (searchParams.get("huella") ?? "").trim().toLowerCase();

    if (!esFolioDeFamilia(folio, PREFIJOS_JUNTOS)) {
      return NextResponse.json(
        { error: "El folio no tiene el formato esperado. Cópialo del pie de tu documento." },
        { status: 400 }
      );
    }
    // Una huella con formato raro se ignora en vez de rechazar la consulta: el
    // folio por sí solo ya es una verificación válida.
    const huella = PATRON_HUELLA.test(huellaCruda) ? huellaCruda : null;

    const resultado = await verificarDocumento(folio, huella);
    return NextResponse.json(resultado);
  } catch {
    console.error("GET /api/juntos/verificar: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
