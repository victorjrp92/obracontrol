/**
 * Pantalla para un enlace de documento que no lleva a ninguna parte.
 *
 * Dice lo mismo tanto si el enlace fue revocado como si el documento no es de
 * esta obra. Es a propósito: dos mensajes distintos convertirían el enlace en un
 * detector de folios ajenos.
 */
export default function EnlaceNoDisponible() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <div className="max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/seiricon-icon.png" alt="Seiricon" className="mx-auto mb-6 h-16 w-16" />
        <h1 className="mb-2 text-xl font-bold text-slate-900">Este documento no está disponible</h1>
        <p className="text-base leading-relaxed text-slate-500">
          El enlace que recibiste ya no está activo, o el documento no corresponde a esta obra.
          Solicita uno nuevo a quien te lo compartió.
        </p>
      </div>
    </div>
  );
}
