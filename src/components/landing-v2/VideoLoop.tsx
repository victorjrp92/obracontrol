"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Ruta al .mp4 (mudo, H.264) en /public */
  src: string;
  /** Poster estático (se muestra hasta que el video entra en vista) */
  poster: string;
  /** Descripción del contenido para lectores de pantalla */
  label: string;
  className?: string;
};

/**
 * Video mudo en loop para flujos reales. Nunca hace autoplay:
 * arranca solo cuando entra en viewport (IntersectionObserver) y se pausa al
 * salir. Respeta prefers-reduced-motion (se queda en el poster). `preload="none"`
 * → lazy: el video no se descarga hasta que se acerca a la vista.
 */
export default function VideoLoop({ src, poster, label, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // solo poster, sin reproducir

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            void el.play().catch(() => {
              /* el navegador puede bloquear play(); no pasa nada, queda el poster */
            });
          } else {
            el.pause();
          }
        });
      },
      { threshold: 0.25 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      width={1280}
      height={720}
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      aria-label={label}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
