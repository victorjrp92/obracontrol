/**
 * Semáforo de concurrencia para las rutas que renderizan PDF.
 *
 * POR QUÉ EN MEMORIA, SI EL RATE LIMIT POR IP NO SIRVE ASÍ
 * Son cosas distintas. El rate limit por IP en memoria es débil porque el
 * recurso que protege —la base de datos, la cuota de Resend— es GLOBAL: cuando
 * Vercel escala, cada instancia nueva arranca con el contador en cero y el
 * techo efectivo se multiplica justo durante el pico. Este semáforo protege un
 * recurso LOCAL: la CPU y la memoria de esta instancia. Ahí la cuenta en
 * memoria es exactamente la correcta, porque coincide con lo que se agota.
 *
 * QUÉ EVITA
 * `renderToBuffer` de react-pdf con hasta 10 fotos incrustadas en base64 (tope
 * de 3,5 MB de cuerpo) pica en cientos de MB. Dos en paralelo es lo que cabe
 * con holgura en una función de 1 GB. Sin este freno, el pico no se degrada: se
 * acumulan peticiones hasta que la función muere por memoria y la persona
 * recibe un timeout de 60 segundos DESPUÉS de haber llenado todo el formulario
 * —cédula incluida— y de haber dado sus datos de contacto.
 *
 * Ese es el peor sitio donde puede fallar el producto: hizo el trabajo, entregó
 * sus datos y se queda sin documento. Un «vuelve en un minuto» honesto es
 * infinitamente mejor, y además conserva el lead.
 */

/** Renders simultáneos por instancia. Ajustable sin desplegar código nuevo. */
const MAX_CONCURRENTES = Math.max(1, Number(process.env.PDF_MAX_CONCURRENTES ?? 2));

let enVuelo = 0;

/** ¿Hay cupo para renderizar ahora? Si devuelve `true`, DEBES llamar a `soltarCupo()`. */
export function tomarCupo(): boolean {
  if (enVuelo >= MAX_CONCURRENTES) return false;
  enVuelo++;
  return true;
}

/** Libera el cupo. Va SIEMPRE en un `finally`: sin eso, un error lo deja tomado para siempre. */
export function soltarCupo(): void {
  enVuelo = Math.max(0, enVuelo - 1);
}

/** Segundos que se le piden al cliente esperar cuando no hay cupo (cabecera Retry-After). */
export const ESPERA_SUGERIDA_SEGUNDOS = 30;

/** Mensaje único para las cuatro rutas: dice la verdad y no culpa a la persona. */
export const MENSAJE_SIN_CUPO =
  "Estamos generando muchos documentos en este momento. Espera unos segundos e intenta de nuevo — tus datos siguen aquí.";
