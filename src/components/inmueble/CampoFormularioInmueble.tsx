import type { ReactNode } from "react";

interface CampoFormularioInmuebleProps {
  /** `id` del control que envuelve. Se ignora cuando `comoGrupo` está activo. */
  id: string;
  label: string;
  /** La justificación del campo: por qué se pide. Va ARRIBA del control, no debajo. */
  pista?: string;
  error?: string;
  obligatorio?: boolean;
  /**
   * Para grupos de botones (tipo de inmueble, sí/no), donde no hay un único
   * control al que apuntar: se pinta `fieldset` + `legend` en vez de `label`.
   */
  comoGrupo?: boolean;
  children: ReactNode;
}

/**
 * Envoltorio de un campo del bloque del inmueble: etiqueta, microcopy que lo
 * justifica, control y error.
 *
 * La pista va ANTES del control a propósito. Casi todos los campos del bloque
 * son opcionales, y una razón que se lee después de decidir saltarse el campo
 * llega tarde — es el mismo orden de `GateDatos.tsx`.
 */
export default function CampoFormularioInmueble({
  id,
  label,
  pista,
  error,
  obligatorio = false,
  comoGrupo = false,
  children,
}: CampoFormularioInmuebleProps) {
  const contenido = (
    <>
      {pista && (
        <p id={`${id}-pista`} className="mb-2 text-xs leading-relaxed text-slate-500">
          {pista}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </>
  );

  if (comoGrupo) {
    return (
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-slate-700">{label}</legend>
        {contenido}
      </fieldset>
    );
  }

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {obligatorio && <span className="ml-1 text-red-500">*</span>}
      </label>
      {contenido}
    </div>
  );
}
