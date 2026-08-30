import { fallar } from "./errores";
import type { NivelUbicacion, Ubicacion } from "./tipos";

/**
 * A qué se ata un producto técnico.
 *
 * Tres niveles y una regla dura: SIEMPRE hay obra. Los planos de implantación
 * y el registro fotográfico general son de la obra entera; un plano de
 * distribución es de un piso; un plano de acabados o un render son de una
 * unidad. Ninguno de los tres flota sin obra — si flotara, no habría contra
 * qué cobrarle el cupo, ni tenant contra el que aislarlo, ni obra que borrar
 * en cascada cuando se borra el proyecto.
 *
 * Piso y unidad son EXCLUYENTES. La unidad ya cuelga de un piso: mandar los
 * dos permite mandarlos incoherentes (unidad del piso 3 declarada en el piso
 * 7), y entonces «¿de qué piso es este plano?» tiene dos respuestas.
 */

/** Vacíos, espacios y `undefined` se normalizan a `null` antes de validar. */
export function normalizarUbicacion(cruda: Ubicacion): Ubicacion {
  return {
    proyectoId: (cruda.proyectoId ?? "").trim(),
    pisoId: vacioANulo(cruda.pisoId),
    unidadId: vacioANulo(cruda.unidadId),
  };
}

function vacioANulo(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").trim();
  return limpio.length > 0 ? limpio : null;
}

/** Nivel al que quedó atado. Asume una ubicación ya validada. */
export function nivelDeUbicacion(ubicacion: Ubicacion): NivelUbicacion {
  if (ubicacion.unidadId) return "UNIDAD";
  if (ubicacion.pisoId) return "PISO";
  return "OBRA";
}

/** Valida la forma de la ubicación. No mira la base: solo coherencia. */
export function validarUbicacion(ubicacion: Ubicacion): Ubicacion {
  const normal = normalizarUbicacion(ubicacion);

  if (!normal.proyectoId) {
    fallar(
      400,
      "UBICACION_INVALIDA",
      "Todo producto técnico pertenece a una obra: falta el proyecto.",
    );
  }

  if (normal.pisoId && normal.unidadId) {
    fallar(
      400,
      "UBICACION_INVALIDA",
      "Un archivo se ata a la obra, a un piso o a una unidad, no a un piso y a una unidad a la vez.",
    );
  }

  return normal;
}
