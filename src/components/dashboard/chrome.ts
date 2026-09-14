/**
 * Recetas de clases del «chrome» — barra lateral y barra superior.
 *
 * Las cuatro barras laterales (Sidebar, SidebarDirectivo, SidebarContratista,
 * SidebarSuperAdmin) repiten el mismo menú con distinto contenido. Las recetas
 * viven aquí, en un módulo, y no copiadas cuatro veces en el JSX: así el gesto
 * se cambia en un sitio. Es el mismo patrón que `clasesBoton()` de
 * components/ui/Boton.tsx.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ LA BARRA SIGUE SIENDO OSCURA
 *
 * No es que se haya quedado sin migrar: el navy de la barra ES un color del
 * sistema. `--navy` de Vivo/Aizome es #0f172a, exactamente el `slate-900` que
 * la barra ya tenía, y la propia landing dibuja la app de Seiricon con barra
 * lateral navy e item activo índigo — ver `.lgo .hd-side` / `.hd-item.act` en
 * src/components/landing-go/landing-go.css. O sea: el sistema ya tenía una
 * opinión sobre esta pantalla y coincidía con lo que había.
 *
 * Lo que NO coincidía era todo lo demás: la tipografía, los pesos, el color de
 * los items apagados (slate-400, 6.96:1) y los radios. Eso es lo que cambia.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * LA REGLA DE LA SOMBRA SOBRE FONDO OSCURO
 *
 * La sombra dura del sistema es de tinta (#0b1220). Sobre navy (#0f172a) la
 * tinta desaparece: 1.05 de contraste. El sistema ya resolvió esto y lo dejó
 * escrito —landing-go.css: «sobre la banda navy la sombra dura de tinta
 * desaparece: pasa a blanca», con `border-color:#fff; box-shadow:4px 4px 0 #fff`—
 * y lo mismo hace el hero de Juntos. Aquí se aplica esa inversión: dentro de la
 * barra, la tinta es blanca; fuera de ella (hamburguesa, botón de colapso, que
 * caen sobre papel) la tinta vuelve a ser tinta.
 *
 * Y la sombra va SOLO en el item activo. No es adorno de estado: en la landing
 * la sombra dura marca lo seleccionado (`.opcion.sel` lleva `3px 3px 0`), y
 * como sólo hay un item activo a la vez, en toda la barra hay exactamente una
 * sombra. Repartirla por los diez items haría vibrar la columna entera, que es
 * justo lo que este sistema no debe hacer en una pantalla densa.
 */

/** Superficie de la barra. `bg-navy` es el token; el pixel es el mismo de antes. */
export const BARRA_FONDO = "bg-navy";

/**
 * Líneas internas de la barra. Antes `border-slate-800`, un gris frío suelto.
 * La línea fina del sistema es tinta sobre papel; sobre navy se invierte a
 * blanco translúcido, que es la misma línea vista del otro lado.
 */
export const BARRA_LINEA = "border-white/10";

/** Texto apagado dentro de la barra: el literal de `.lgo .hd-item`. 11.24:1 sobre navy. */
export const BARRA_TEXTO_APAGADO = "text-[#c2cee2]";

/** Bajada del logo: el literal de `.lgo .hd-logo small`. 8.10:1 sobre navy. */
export const BARRA_TEXTO_TENUE = "text-[#9fb0c9]";

/** Acento del item activo. El súper admin conserva el suyo (ver clasesItemNav). */
export type AcentoBarra = "azul" | "rojo";

/**
 * Item del menú.
 *
 * El activo se lleva el gesto: fondo de acento, borde blanco de 2.5px, sombra
 * dura blanca de 3px, y se hunde al pulsarlo (la sombra cae a 1px y el item se
 * desplaza 2px hacia abajo-derecha) igual que un botón del sistema.
 *
 * El inactivo NO se mueve al pasar por encima. Un botón se levanta porque se va
 * a pulsar; diez filas de menú levantándose de una en una es ruido en una
 * columna que el usuario recorre con la vista. Cambia el fondo y el texto, nada
 * más. El borde transparente de 2.5px está siempre para que activarse no
 * desplace el texto.
 *
 * El acento rojo del súper admin NO es decoración: es el rojo del sistema
 * (--rojo, #dc2626) marcando la consola del dueño, y estaba ahí antes de esta
 * migración. Cambiarlo a índigo borraría la única señal de «estás en la
 * consola peligrosa». Se escribe con var() porque el rojo no tiene utilidad
 * propia a propósito —en este producto el rojo significa RECHAZADO— y así
 * escribirlo obliga a justificarlo.
 */
export function clasesItemNav(
  activo: boolean,
  colapsado: boolean,
  acento: AcentoBarra = "azul"
): string {
  const base =
    // min-h-11 (44px) y no sólo el padding: con la barra colapsada el item se
    // queda sin texto, y sin la caja de línea del texto la fila medía 42px —por
    // debajo del objetivo de puntero AAA (WCAG 2.5.5) que cumple el resto—.
    "flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm border-[2.5px] " +
    "transition-[color,background-color,box-shadow,transform] duration-150 " +
    "motion-reduce:transition-none " +
    "focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-white focus-visible:outline-offset-2";

  const estado = activo
    ? [
        acento === "rojo" ? "bg-[var(--rojo)]" : "bg-azul",
        "text-white font-extrabold border-white shadow-[3px_3px_0_#fff]",
        "active:shadow-[1px_1px_0_#fff] active:translate-x-0.5 active:translate-y-0.5",
      ].join(" ")
    : `font-semibold ${BARRA_TEXTO_APAGADO} border-transparent hover:text-white hover:bg-white/10`;

  return [base, estado, colapsado ? "justify-center" : ""].filter(Boolean).join(" ");
}

/**
 * Salir. Es la única acción destructiva del menú y por eso vira a rojo al pasar
 * por encima — pero al rojo que el sistema usa SOBRE navy (#fca5a5, el de
 * `.lgo .alarma svg`), no a `--rojo`, que sobre navy da 3.70:1 y no llega ni a AA.
 */
export function clasesSalir(colapsado: boolean): string {
  return [
    // 44px por alto mínimo y NO por un borde transparente: el borde metería el
    // texto 2.5px hacia dentro y «Salir» quedaría desalineado con la fila de
    // Notificaciones, que es su vecina inmediata y no lleva borde. Entre dos
    // filas pegadas, la sangría se ve; contra los items del menú, que están al
    // otro lado de un separador, no.
    "flex items-center gap-3 px-3 min-h-11 rounded-xl text-sm font-semibold w-full",
    BARRA_TEXTO_APAGADO,
    "hover:text-[#fca5a5] hover:bg-white/10 transition-colors motion-reduce:transition-none",
    "focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-white focus-visible:outline-offset-2",
    colapsado ? "justify-center" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Botón de colapsar, colgado del borde derecho de la barra. Cae SOBRE el papel
 * del contenido, así que aquí la tinta vuelve a ser tinta: blanco, borde de
 * tinta y sombra dura de tinta, con el hundimiento del sistema.
 * Sube de 24 a 28px: 24 es justo el mínimo de WCAG 2.2 §2.5.8 y este botón
 * está pegado al borde de la barra, donde el puntero llega de refilón.
 */
export const CLASES_TOGGLE_COLAPSO =
  "absolute -right-3.5 top-20 w-7 h-7 rounded-full bg-white text-tinta " +
  "border-2 border-tinta shadow-[2px_2px_0_var(--tinta)] " +
  "hidden lg:flex items-center justify-center z-10 " +
  "transition-[box-shadow,transform] duration-150 motion-reduce:transition-none " +
  "active:shadow-[1px_1px_0_var(--tinta)] active:translate-x-px active:translate-y-px " +
  "focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-azul focus-visible:outline-offset-2";

/**
 * Hamburguesa de móvil. Flota sobre el papel del contenido, así que lleva el
 * gesto completo en tinta. Pasa de 40 a 44px (objetivo táctil AAA, WCAG 2.5.5);
 * por eso el título del Topbar corre de `pl-12` a `pl-[60px]`.
 *
 * Era navy con icono blanco. AL RENDERIZARLA A 3x se vio el fallo: la sombra
 * dura es de tinta (#0b1220) y el botón era navy (#0f172a) —1.05 de contraste—,
 * así que la sombra no se leía como sombra sino como un bulto del propio botón.
 * Pasa al botón por defecto del sistema, que es blanco con borde y sombra de
 * tinta (`.ljt .btn`): ahí la sombra sí es sombra.
 */
export function clasesHamburguesa(cajonAbierto: boolean): string {
  return [
    "lg:hidden fixed top-3 left-3 z-50 w-11 h-11 rounded-full bg-white text-tinta",
    "border-[2.5px] border-tinta shadow-[3px_3px_0_var(--tinta)]",
    "flex items-center justify-center",
    "transition-[box-shadow,transform,opacity] duration-150 motion-reduce:transition-none",
    "active:shadow-[1px_1px_0_var(--tinta)] active:translate-x-0.5 active:translate-y-0.5",
    "focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-tinta focus-visible:outline-offset-2",
    // Con el cajón abierto la hamburguesa queda DEBAJO de él y pisando el logo.
    // Antes no se notaba porque era navy sobre un cajón navy: invisible por
    // accidente. Siendo blanca hay que apagarla a propósito. No cambia ningún
    // comportamiento: el <aside> va después en el DOM con el mismo z-index, así
    // que ya se comía los clics; esto sólo la retira de la vista mientras el
    // cajón entra, y la devuelve cuando sale.
    cajonAbierto ? "opacity-0 pointer-events-none" : "opacity-100",
  ].join(" ");
}

/** Cierre del cajón móvil, dentro de la barra: inversión a blanco. */
export const CLASES_CERRAR_MOVIL =
  "lg:hidden p-1 rounded-lg hover:text-white hover:bg-white/10 " +
  BARRA_TEXTO_APAGADO + " " +
  "transition-colors motion-reduce:transition-none " +
  "focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-white focus-visible:outline-offset-2";

/**
 * Velo del cajón móvil. Era `bg-black/50`: negro puro, un color que no está en
 * ninguna parte del sistema. El velo de Aizome es de tinta —el hero de Juntos
 * usa `rgba(11,18,32,…)`—.
 */
export const CLASES_VELO_MOVIL = "lg:hidden fixed inset-0 z-40 bg-tinta/50";

/** Avatar. Círculo de acento con borde —`.ljt .jt-paso .n` lo lleva de tinta; aquí, invertido, blanco. */
export const CLASES_AVATAR =
  "w-8 h-8 rounded-full border-2 border-white flex items-center justify-center " +
  "text-white text-xs font-extrabold flex-shrink-0";

/**
 * CTA «Nueva obra» de las cuentas personales.
 *
 * Es un BOTÓN, no una fila de menú. Se pintó primero en índigo con borde y
 * sombra blancos y AL RENDERIZARLO quedó calcado del item activo: dos bloques
 * índigo pegados, uno encima del otro, sin decir cuál marca dónde estás. La
 * forma sola (pastilla contra rectángulo) no bastaba.
 *
 * Así que se va al botón por defecto del sistema, que es BLANCO —`.ljt .btn`
 * lleva `background:#fff; color: var(--tinta)`— con la inversión de fondo
 * oscuro aplicada encima, exactamente como la landing pinta su botón sobre la
 * banda navy (`.lgo #precio .btn`: borde y sombra blancos). Resultado: el CTA
 * es lo más claro de la barra (es la acción principal) y el item activo es lo
 * único índigo (es el «estás aquí»). Dos papeles, dos aspectos.
 *
 * Y como es un botón de verdad, sí se levanta al pasar por encima. Con
 * movimiento reducido se queda quieto y sólo crece la sombra —el aviso se
 * mantiene sin desplazar nada—, pero el hundimiento al pulsar se conserva:
 * es la respuesta al gesto del propio usuario, no una animación.
 */
export function clasesCtaBarra(colapsado: boolean): string {
  return [
    "flex items-center gap-2 rounded-full bg-white text-tinta text-sm font-extrabold",
    "border-[2.5px] border-white shadow-[3px_3px_0_#fff]",
    "transition-[box-shadow,transform] duration-150 motion-reduce:transition-none",
    "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#fff]",
    "motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0",
    "active:shadow-[1px_1px_0_#fff] active:translate-x-0.5 active:translate-y-0.5",
    "focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-white focus-visible:outline-offset-2",
    colapsado ? "justify-center p-2.5" : "px-4 py-2.5",
  ].join(" ");
}

/**
 * Rótulo de sección dentro de la barra (el «Administración» del directivo).
 * Era `text-slate-500`: 3.75:1 sobre navy para un texto de 10px en versalitas,
 * que es justo donde el contraste importa más. Pasa al tenue del sistema.
 */
export const CLASES_ROTULO_SECCION =
  "px-3 text-[10px] font-extrabold uppercase tracking-[0.12em] " + BARRA_TEXTO_TENUE;
