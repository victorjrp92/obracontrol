"use client";

import { COPY_INMUEBLE, LABEL_HABITADA, LABEL_TIPO_PROPIEDAD, SUBTITULO_BLOQUE, TITULO_BLOQUE } from "@/lib/inmueble/copys";
import type { CampoInmueble, FormularioInmueble, TipoPropiedad } from "@/lib/inmueble/tipos";
import type { ErroresInmueble } from "@/lib/inmueble/validacion";
import CampoFormularioInmueble from "./CampoFormularioInmueble";
import PistaNormaSismica from "./PistaNormaSismica";

interface BloqueDatosInmuebleProps {
  valor: FormularioInmueble;
  onChange: (valor: FormularioInmueble) => void;
  /** Errores por campo, tal como los devuelve `validarFormularioInmueble`. */
  errores?: ErroresInmueble;
  /** Prefijo de los `id`: permite dos bloques en la misma página. */
  idPrefijo?: string;
  /** El encabezado se oculta cuando el bloque va dentro de un paso que ya tiene título. */
  ocultarTitulo?: boolean;
  className?: string;
}

const CLASES_INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

const CLASES_CHIP_BASE =
  "rounded-xl border px-3 py-3 text-sm font-medium transition-colors min-h-11";
const CLASES_CHIP_SEL = "border-blue-400 bg-blue-50 text-blue-800";
const CLASES_CHIP_NO = "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white";

const TIPOS: TipoPropiedad[] = ["CASA", "APARTAMENTO", "EDIFICIO", "LOCAL"];

/**
 * Bloque reutilizable de datos del inmueble (spec-arquitecto-2026-08.md, B8).
 * Lo consumen el wizard de proyecto, el acta de estado inicial y la línea
 * Juntos: se escribe una vez y sale impreso en todos los documentos.
 *
 * Componente CONTROLADO y sin estado propio: el dueño del formulario guarda
 * `FormularioInmueble` y decide cuándo validar. Así el mismo bloque sirve
 * dentro de un wizard por pasos y dentro de una pantalla de edición, sin dos
 * fuentes de verdad.
 *
 * Móvil primero: una columna, controles de 44 px de alto, `text-base` en los
 * inputs (por debajo de 16 px, iOS hace zoom al enfocar y descoloca la
 * pantalla) y teclado numérico donde toca. Esto se llena de pie en la obra.
 *
 * Todo es opcional salvo la dirección. Nadie tiene la matrícula a mano cuando
 * está registrando una obra.
 */
export default function BloqueDatosInmueble({
  valor,
  onChange,
  errores = {},
  idPrefijo = "inm",
  ocultarTitulo = false,
  className = "",
}: BloqueDatosInmuebleProps) {
  const id = (campo: CampoInmueble) => `${idPrefijo}-${campo}`;

  function set(campo: CampoInmueble, nuevo: string) {
    onChange({ ...valor, [campo]: nuevo });
  }

  /** Los chips se apagan al volver a tocarlos: sin esto no hay forma de deshacer una respuesta. */
  function alternar(campo: CampoInmueble, opcion: string) {
    set(campo, valor[campo] === opcion ? "" : opcion);
  }

  function propsCampo(campo: CampoInmueble) {
    return {
      id: id(campo),
      value: valor[campo],
      "aria-invalid": Boolean(errores[campo]),
      "aria-describedby": errores[campo] ? `${id(campo)}-error` : `${id(campo)}-pista`,
      className: CLASES_INPUT,
    };
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`.trim()}>
      {!ocultarTitulo && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{TITULO_BLOQUE}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{SUBTITULO_BLOQUE}</p>
        </div>
      )}

      <CampoFormularioInmueble
        id={id("direccion_inmueble")}
        label={COPY_INMUEBLE.direccion_inmueble.label}
        pista={COPY_INMUEBLE.direccion_inmueble.pista}
        error={errores.direccion_inmueble}
        obligatorio
      >
        <input
          {...propsCampo("direccion_inmueble")}
          type="text"
          autoComplete="street-address"
          placeholder={COPY_INMUEBLE.direccion_inmueble.placeholder}
          onChange={(e) => set("direccion_inmueble", e.target.value)}
        />
      </CampoFormularioInmueble>

      <CampoFormularioInmueble
        id={id("conjunto_edificio")}
        label={COPY_INMUEBLE.conjunto_edificio.label}
        pista={COPY_INMUEBLE.conjunto_edificio.pista}
        error={errores.conjunto_edificio}
      >
        <input
          {...propsCampo("conjunto_edificio")}
          type="text"
          placeholder={COPY_INMUEBLE.conjunto_edificio.placeholder}
          onChange={(e) => set("conjunto_edificio", e.target.value)}
        />
      </CampoFormularioInmueble>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <CampoFormularioInmueble
          id={id("unidad_inmueble")}
          label={COPY_INMUEBLE.unidad_inmueble.label}
          pista={COPY_INMUEBLE.unidad_inmueble.pista}
          error={errores.unidad_inmueble}
        >
          <input
            {...propsCampo("unidad_inmueble")}
            type="text"
            placeholder={COPY_INMUEBLE.unidad_inmueble.placeholder}
            onChange={(e) => set("unidad_inmueble", e.target.value)}
          />
        </CampoFormularioInmueble>

        <CampoFormularioInmueble
          id={id("ciudad")}
          label={COPY_INMUEBLE.ciudad.label}
          pista={COPY_INMUEBLE.ciudad.pista}
          error={errores.ciudad}
        >
          <input
            {...propsCampo("ciudad")}
            type="text"
            autoComplete="address-level2"
            placeholder={COPY_INMUEBLE.ciudad.placeholder}
            onChange={(e) => set("ciudad", e.target.value)}
          />
        </CampoFormularioInmueble>
      </div>

      <CampoFormularioInmueble
        id={id("matricula_inmobiliaria")}
        label={COPY_INMUEBLE.matricula_inmobiliaria.label}
        pista={COPY_INMUEBLE.matricula_inmobiliaria.pista}
        error={errores.matricula_inmobiliaria}
      >
        <input
          {...propsCampo("matricula_inmobiliaria")}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={COPY_INMUEBLE.matricula_inmobiliaria.placeholder}
          onChange={(e) => set("matricula_inmobiliaria", e.target.value)}
        />
      </CampoFormularioInmueble>

      <CampoFormularioInmueble
        id={id("tipo_propiedad")}
        label={COPY_INMUEBLE.tipo_propiedad.label}
        pista={COPY_INMUEBLE.tipo_propiedad.pista}
        error={errores.tipo_propiedad}
        comoGrupo
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS.map((tipo) => {
            const sel = valor.tipo_propiedad === tipo;
            return (
              <button
                key={tipo}
                type="button"
                aria-pressed={sel}
                onClick={() => alternar("tipo_propiedad", tipo)}
                className={`${CLASES_CHIP_BASE} ${sel ? CLASES_CHIP_SEL : CLASES_CHIP_NO}`}
              >
                {LABEL_TIPO_PROPIEDAD[tipo]}
              </button>
            );
          })}
        </div>
      </CampoFormularioInmueble>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <CampoFormularioInmueble
          id={id("metraje_total")}
          label={COPY_INMUEBLE.metraje_total.label}
          pista={COPY_INMUEBLE.metraje_total.pista}
          error={errores.metraje_total}
        >
          <div className="relative">
            <input
              {...propsCampo("metraje_total")}
              type="text"
              inputMode="decimal"
              placeholder={COPY_INMUEBLE.metraje_total.placeholder}
              onChange={(e) => set("metraje_total", e.target.value)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              m²
            </span>
          </div>
        </CampoFormularioInmueble>

        <CampoFormularioInmueble
          id={id("altura_libre_m")}
          label={COPY_INMUEBLE.altura_libre_m.label}
          pista={COPY_INMUEBLE.altura_libre_m.pista}
          error={errores.altura_libre_m}
        >
          <div className="relative">
            <input
              {...propsCampo("altura_libre_m")}
              type="text"
              inputMode="decimal"
              placeholder={COPY_INMUEBLE.altura_libre_m.placeholder}
              onChange={(e) => set("altura_libre_m", e.target.value)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              m
            </span>
          </div>
        </CampoFormularioInmueble>
      </div>

      <CampoFormularioInmueble
        id={id("anio_construccion")}
        label={COPY_INMUEBLE.anio_construccion.label}
        pista={COPY_INMUEBLE.anio_construccion.pista}
        error={errores.anio_construccion}
      >
        <input
          {...propsCampo("anio_construccion")}
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder={COPY_INMUEBLE.anio_construccion.placeholder}
          onChange={(e) => set("anio_construccion", e.target.value.replace(/\D/g, ""))}
        />
        <PistaNormaSismica anio={valor.anio_construccion} />
      </CampoFormularioInmueble>

      <CampoFormularioInmueble
        id={id("habitada_durante_obra")}
        label={COPY_INMUEBLE.habitada_durante_obra.label}
        pista={COPY_INMUEBLE.habitada_durante_obra.pista}
        error={errores.habitada_durante_obra}
        comoGrupo
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["si", "no"] as const).map((opcion) => {
            const sel = valor.habitada_durante_obra === opcion;
            return (
              <button
                key={opcion}
                type="button"
                aria-pressed={sel}
                onClick={() => alternar("habitada_durante_obra", opcion)}
                className={`${CLASES_CHIP_BASE} text-left ${sel ? CLASES_CHIP_SEL : CLASES_CHIP_NO}`}
              >
                {LABEL_HABITADA[opcion]}
              </button>
            );
          })}
        </div>
      </CampoFormularioInmueble>

      <CampoFormularioInmueble
        id={id("solicitante")}
        label={COPY_INMUEBLE.solicitante.label}
        pista={COPY_INMUEBLE.solicitante.pista}
        error={errores.solicitante}
      >
        <input
          {...propsCampo("solicitante")}
          type="text"
          placeholder={COPY_INMUEBLE.solicitante.placeholder}
          onChange={(e) => set("solicitante", e.target.value)}
        />
      </CampoFormularioInmueble>
    </div>
  );
}
