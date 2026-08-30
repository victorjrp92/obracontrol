/**
 * Interruptor de emergencia de «Juntos».
 *
 * QUÉ ES: una palanca manual para bajar la línea entera sin desplegar código.
 * No es un límite de aforo ni una cola — es el freno que se jala cuando algo
 * está mal: un abuso, un error en la información legal, un pico que la
 * infraestructura no aguanta, o cualquier cosa que haga más daño encendida
 * que apagada.
 *
 * POR QUÉ MANUAL Y NO AUTOMÁTICO: un corte automático por conteo necesita un
 * contador compartido entre instancias, y cuando Vercel escala cada instancia
 * arranca en cero — el umbral se multiplica justo en el pico, que es cuando
 * tendría que funcionar. Un contador que miente en el único momento que
 * importa es peor que no tenerlo. El aviso de que algo pasa lo dan las
 * notificaciones de uso de Vercel; esta palanca es la respuesta, no la alarma.
 *
 * CÓMO SE ACTIVA: variable de entorno `JUNTOS_PAUSADO=true` en Vercel, y
 * redesplegar. Vercel aplica las variables al construir, así que el cambio
 * tarda uno o dos minutos en subir. Si algún día hacen falta segundos en vez
 * de minutos, la vía es Edge Config (lectura en el borde, sin redespliegue);
 * no se monta hoy porque añade una pieza más por dos minutos de diferencia.
 *
 * QUÉ APAGA: las tres páginas de /go/juntos, las cuatro rutas de API y la
 * franja de emergencia de las landings — no tiene sentido invitar a una
 * puerta cerrada.
 *
 * QUÉ NO APAGA: /go/juntos/verificar. Por eso la compuerta va en cada página
 * y NO en el layout compartido: el layout envuelve también a /verificar, y
 * pausarlo ahí lo habría tumbado con el resto. Quien tenga un acta y una
 * aseguradora pidiéndole comprobarla debe poder hacerlo aunque la línea esté
 * pausada: es una consulta de solo lectura, barata, y negarla castigaría
 * justo a quien ya confió en el documento.
 */

/** ¿La línea Juntos está pausada? Solo servidor. */
export function juntosPausado(): boolean {
  return process.env.JUNTOS_PAUSADO === "true";
}

/** Mensaje único: dice la verdad, no culpa a nadie y da una salida real. */
export const MENSAJE_PAUSA =
  "Estamos recibiendo muchísima gente en este momento y preferimos parar antes que darte un documento a medias. Vuelve en un rato — no perdiste nada, y aquí seguimos.";

/** Respuesta de las rutas de API cuando está pausado. */
export const MENSAJE_PAUSA_API =
  "Juntos está pausado unos minutos por saturación. Vuelve en un rato — tus datos no se enviaron a ninguna parte.";
