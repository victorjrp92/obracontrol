import { NextRequest, NextResponse } from "next/server";
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
 */

const MAX_POR_MINUTO_POR_IP = 20;
const FOLIO_RE = /^(JT|DP)-\d{8}-[0-9a-f]{6}$/;
const HUELLA_RE = /^[0-9a-f]{8,64}$/;

/**
 * Deja el folio exactamente como lo guarda `generarFolio()`: prefijo en
 * MAYÚSCULA y la parte aleatoria en minúscula (`randomBytes(3).toString("hex")`).
 *
 * Hace falta porque la persona lo copia a mano del pie de un PDF y puede
 * escribirlo como sea. La primera versión pasaba todo a mayúsculas y así NINGÚN
 * folio válido pasaba el filtro — el hex quedaba en mayúscula y la expresión
 * regular solo acepta minúscula. Lo cazó la primera prueba contra el servidor.
 */
function normalizarFolio(crudo: string): string {
  const partes = crudo.trim().split("-");
  if (partes.length !== 3) return crudo.trim();
  return `${partes[0].toUpperCase()}-${partes[1]}-${partes[2].toLowerCase()}`;
}

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

    if (!FOLIO_RE.test(folio)) {
      return NextResponse.json(
        { error: "El folio no tiene el formato esperado. Cópialo del pie de tu documento." },
        { status: 400 }
      );
    }
    // Una huella con formato raro se ignora en vez de rechazar la consulta: el
    // folio por sí solo ya es una verificación válida.
    const huella = HUELLA_RE.test(huellaCruda) ? huellaCruda : null;

    const resultado = await verificarDocumento(folio, huella);
    return NextResponse.json(resultado);
  } catch {
    console.error("GET /api/juntos/verificar: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
