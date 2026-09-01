/**
 * Guardia de regresión de lint.
 *
 * El repo arrastraba 13 errores de eslint ANTERIORES a este trabajo: setState
 * dentro de efectos, funciones impuras en render y comillas sin escapar. Una
 * compuerta que exigiera «0 errores» habría fallado desde el primer commit sin
 * decir nada útil, y la tentación entonces es relajarla hasta que no signifique
 * nada.
 *
 * Esta mide lo que sí importa: **que no añadamos errores nuevos**.
 *
 * leaf-6.1 reparó 12 de los 13 y bajó la línea base de 13 a 1:
 *   · 3 `react-hooks/purity` (`Date.now()` en el cuerpo de un Server Component)
 *     en `super-admin/pwa-metricas/page.tsx` → el reloj se lee en una función
 *     fuera del componente.
 *   · 4 `react/no-unescaped-entities` en `(public)/contacto` y
 *     `(public)/terminos` → comillas tipográficas.
 *   · 3 `react-hooks/set-state-in-effect` en la cadena PWA
 *     (`lib/pwa-install.ts`, `InstallBannerTopbar`, `InstallPrompt`) → el
 *     singleton de instalación y `localStorage` ya eran stores externos y ahora
 *     se leen con `useSyncExternalStore` en vez de copiarse a estado.
 *   · 2 `react-hooks/set-state-in-effect` de carga inicial
 *     (`configuracion/clientes`, `NotificacionesContext`) → el fetch va dentro
 *     de una función async, así que el setState ya no cae en el render.
 *
 * EL ÚLTIMO, ya reparado:
 *   · `src/components/tour/TourProvider.tsx` — `recompute()` mide el `DOMRect`
 *     del objetivo del tour y lo guarda con `setRect`. Esta nota decía que
 *     envolverlo no servía, «probado: `useLayoutEffect` recibe exactamente el
 *     mismo error». No es así: con `useLayoutEffect` (a través de un envoltorio
 *     isomorfo, porque avisa en SSR) eslint da limpio. Y además era lo correcto
 *     de por sí — medir el DOM para posicionar un recuadro no es un efecto
 *     secundario, y con `useEffect` el navegador alcanzaba a pintar el foco en
 *     la posición del paso anterior antes de corregirlo.
 *
 * LINEA_BASE queda en 0: ya no hay deuda que tolerar, así que cualquier error
 * nuevo hace fallar esta verificación.
 */
import { execSync } from "node:child_process";

const LINEA_BASE = 0;

const salida = (() => {
  try {
    return execSync("npx eslint . 2>&1", { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stdout?: string };
    return err.stdout ?? "";
  }
})();

// Del RESUMEN («✖ 58 problems (13 errors, 45 warnings)»), no de la primera
// línea que contenga «error»: esa es un número de línea («21:44  error») y
// capturarla daba un conteo inventado. El oráculo tiene que medir lo que dice
// medir, o es peor que no tenerlo.
const m = salida.match(/\((\d+)\s+errors?/);
const errores = m ? Number(m[1]) : 0;
if (!m && /problems?/.test(salida)) {
  console.error("FALLA: no se pudo leer el resumen de eslint. Salida inesperada.");
  process.exit(1);
}

console.log(`linea base: ${LINEA_BASE} errores preexistentes`);
console.log(`ahora:      ${errores} errores`);

if (errores > LINEA_BASE) {
  console.error(`\nFALLA: se añadieron ${errores - LINEA_BASE} errores nuevos.`);
  console.error(salida.split("\n").filter((l) => l.includes("error")).slice(0, 20).join("\n"));
  process.exit(1);
}
if (errores < LINEA_BASE) {
  console.log(`\nSe repararon ${LINEA_BASE - errores} errores de la deuda previa. Baja LINEA_BASE a ${errores}.`);
}
console.log("\n1/1 verificaciones OK");
console.log("Sin errores de lint nuevos.");
