import type { TipoCuenta, TipoProductoTecnico } from "@/generated/prisma";
import { assertPerfilConAcceso } from "./acceso";
import { verificarCupo, verificarTamanoArchivo } from "./cupo";
import { fallar } from "./errores";
import { extensionCanonica, validarArchivo } from "./formatos";
import { nivelDeUbicacion, validarUbicacion } from "./ubicacion";
import { planificarNuevaVersion } from "./versionado";
import type { EntradaSubida, PlanSubida, ProductoVersionado, PuertosSubida } from "./tipos";

/**
 * La decisión completa de una subida, en un solo sitio y sin tocar disco ni
 * base: recibe lo que llegó y tres puertos, y devuelve el plan de escritura o
 * lanza el error que corresponda.
 *
 * Que sea una función pura con puertos inyectados no es estética: es lo que
 * permite verificar el cupo, el aislamiento y la detección de archivos
 * falsificados sin levantar Postgres ni Supabase.
 *
 * EL ORDEN DE LAS GUARDAS ES PARTE DEL DISEÑO. Va de lo barato y más
 * peligroso a lo caro:
 *
 *   1. Perfil (403)      — sin capacidad no se mira ni el nombre del archivo.
 *   2. Campos (400)      — tipo y nombre bien formados.
 *   3. Ubicación (400)   — siempre obra; piso y unidad son excluyentes.
 *   4. Tamaño (413)      — un archivo vacío es «llegó vacío», no «no reconozco
 *                          este formato»: el mensaje tiene que decir qué pasó.
 *   5. Contenido (415)   — magic number. ANTES de cualquier consulta: es el
 *                          único filtro que no se puede falsificar y no cuesta
 *                          nada.
 *   6. Pertenencia (404) — el piso/unidad es de esa obra. Primera consulta.
 *   7. Versión (400)     — el producto que dice reemplazar es reemplazable.
 *   8. Cupo (413)        — la última, porque es un agregado sobre toda la obra.
 */

const TIPOS_VALIDOS: readonly TipoProductoTecnico[] = ["REGISTRO_INICIAL", "PLANO", "RENDER"];

const LARGO_MAX_NOMBRE = 160;
const LARGO_MAX_DESCRIPCION = 1000;

export async function prepararSubida(
  entrada: EntradaSubida,
  puertos: PuertosSubida,
  perfil: TipoCuenta,
): Promise<PlanSubida> {
  // 1 — Perfil.
  assertPerfilConAcceso(perfil);

  // 2 — Campos.
  if (!TIPOS_VALIDOS.includes(entrada.tipo)) {
    fallar(400, "ENTRADA_INVALIDA", "El tipo debe ser REGISTRO_INICIAL, PLANO o RENDER.");
  }
  const nombre = (entrada.nombre ?? "").trim();
  if (!nombre) {
    fallar(400, "ENTRADA_INVALIDA", "Ponle un nombre al producto técnico.");
  }
  if (nombre.length > LARGO_MAX_NOMBRE) {
    fallar(400, "ENTRADA_INVALIDA", `El nombre no puede pasar de ${LARGO_MAX_NOMBRE} caracteres.`);
  }
  const descripcionCruda = (entrada.descripcion ?? "").trim();
  if (descripcionCruda.length > LARGO_MAX_DESCRIPCION) {
    fallar(
      400,
      "ENTRADA_INVALIDA",
      `La descripción no puede pasar de ${LARGO_MAX_DESCRIPCION} caracteres.`,
    );
  }

  // 3 — Ubicación.
  const ubicacion = validarUbicacion(entrada.ubicacion);

  // 4 — Tamaño del archivo suelto.
  verificarTamanoArchivo(entrada.archivo.bytes);

  // 5 — Qué es el archivo DE VERDAD.
  const firma = validarArchivo(entrada.tipo, entrada.archivo);

  // 6 — El piso o la unidad cuelgan de esa obra (y la obra existe en el tenant).
  const perteneceLaUbicacion = await puertos.ubicacionPertenece(ubicacion);
  if (!perteneceLaUbicacion) {
    fallar(
      404,
      "UBICACION_AJENA",
      "La obra, el piso o la unidad no existen o no son de esta cuenta.",
    );
  }

  // 7 — Versionado.
  const idAnterior = (entrada.reemplazaA ?? "").trim();
  let anterior: ProductoVersionado | null = null;
  if (idAnterior) {
    anterior = await puertos.buscarProducto(idAnterior);
    if (!anterior) {
      fallar(404, "NO_ENCONTRADO", "No encontramos la versión que se quiere reemplazar.");
    }
  }
  const plan = planificarNuevaVersion(
    { proyectoId: ubicacion.proyectoId, tipo: entrada.tipo },
    anterior,
  );

  // 8 — Cupo de la obra, contando las versiones reemplazadas.
  const usados = await puertos.bytesUsadosEnObra(ubicacion.proyectoId);
  const cupo = verificarCupo(usados, entrada.archivo.bytes);

  return {
    tipo: entrada.tipo,
    nombre,
    descripcion: descripcionCruda || null,
    ubicacion,
    nivel: nivelDeUbicacion(ubicacion),
    mime: firma.mime,
    bytes: entrada.archivo.bytes,
    version: plan.version,
    reemplazaA: plan.reemplazaA,
    aDesactivar: plan.aDesactivar,
    extension: extensionCanonica(firma.formato),
    cupo,
  };
}
