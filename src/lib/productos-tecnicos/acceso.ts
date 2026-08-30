import type { TipoCuenta } from "@/generated/prisma";
import { puede } from "@/lib/plan";
import { fallar } from "./errores";

/**
 * Quién entra al módulo.
 *
 * La respuesta NO se escribe aquí: vive en la matriz de capacidades de
 * `src/lib/plan.ts`, donde `productosTecnicos` está en `true` para ARQUITECTO
 * y CONSTRUCTORA y en `false` para CONTRATISTA y PROPIETARIO. Este archivo
 * solo la consulta y la convierte en un 403.
 *
 * Escribir una segunda comprobación en paralelo sería la forma más rápida de
 * que un día la matriz diga una cosa y la API otra.
 */
export function perfilPuedeProductosTecnicos(tipo: TipoCuenta): boolean {
  return puede(tipo, "productosTecnicos");
}

/** Corta con 403 si el perfil no tiene la capacidad. */
export function assertPerfilConAcceso(tipo: TipoCuenta): void {
  if (!perfilPuedeProductosTecnicos(tipo)) {
    fallar(
      403,
      "PERFIL_SIN_ACCESO",
      "Los productos técnicos son del perfil Arquitecto y de las cuentas de constructora.",
    );
  }
}
