"use client";

import { useSyncExternalStore } from "react";
import Script from "next/script";
import {
  EVENTO_CONSENTIMIENTO,
  leerConsentimiento,
  type EstadoConsentimiento,
} from "@/lib/consentimiento-cookies";

/**
 * Microsoft Clarity (mapas de calor, scroll y grabaciones) — SOLO en la
 * landing de Juntos.
 *
 * DECISIÓN DELIBERADA (spec-go-juntos.md): esto NO se monta en los wizards ni
 * en el gate de datos. Ahí la persona escribe su cédula y su dirección, y en
 * pantalla hay fotos del interior de su casa dañada; grabar esa sesión
 * contradice la promesa de que la cédula no se guarda. El mapa de calor, en
 * cambio, solo aporta donde hay decisiones de diseño que tomar: la landing.
 *
 * El script no se carga hasta que la persona acepta en el banner (Clarity
 * exige modo de consentimiento en la UE/RU/Suiza desde octubre de 2025, y
 * buena parte de nuestro público es la diáspora en España).
 *
 * El ID del proyecto es público por diseño (viaja en el HTML de cualquier
 * sitio que use Clarity), así que va como constante y puede sobreescribirse
 * con `NEXT_PUBLIC_CLARITY_ID` sin tocar código.
 */

/** Proyecto «Seiricon Go» en clarity.microsoft.com. */
const CLARITY_ID = "y2upgk848g";

/** El consentimiento vive fuera de React (localStorage + evento): se lee con
 *  useSyncExternalStore, que es el mecanismo pensado para esto y evita
 *  sincronizar estado dentro de un efecto. */
function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
  window.addEventListener("storage", alCambiar); // otra pestaña del mismo sitio
  return () => {
    window.removeEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

const enServidor = (): EstadoConsentimiento => "sin-responder";

export default function ClarityJuntos() {
  const consentimiento = useSyncExternalStore(suscribir, leerConsentimiento, enServidor);
  const id = process.env.NEXT_PUBLIC_CLARITY_ID ?? CLARITY_ID;

  if (!id || consentimiento !== "aceptado") return null;

  return (
    <Script id="clarity-juntos" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${id}");`}
    </Script>
  );
}
