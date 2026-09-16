"use client";

// ---------------------------------------------------------------------------
// El PERIODO del informe: seis atajos y dos fechas a mano.
//
// == POR QUE LOS ATAJOS RESUELVEN A DOS FECHAS Y NO VIAJAN SOLOS ============
//
// «Último mes» podría mandarse al servidor como la palabra «mes» y que allí se
// calculara. No se hace por dos razones:
//
//   · El servidor corre en UTC y el usuario está en Colombia. A las 8 de la
//     noche de un 30 de septiembre, para el servidor ya es 1 de octubre: el
//     informe saldría con un rango corrido un día respecto al que el usuario
//     creyó pedir.
//   · Un atajo que no enseña sus dos fechas obliga a fiarse. Aquí, al pulsarlo,
//     los dos campos de fecha SE RELLENAN con lo que produjo: se ve, se puede
//     corregir, y lo que se corrige deja de ser un atajo y pasa a ser un rango
//     propio.
//
// La palabra del atajo sí viaja, pero sólo como ETIQUETA para la portada del
// PDF («último mes»); ningún cálculo depende de ella.
//
// == LA REGLA DE LOS RANGOS ================================================
//
// Una ventana de longitud L que TERMINA HOY, con los dos extremos incluidos.
// «Mes» pedido un 14 de septiembre da del 15 de agosto al 14 de septiembre, no
// del 14 al 14: contar los dos extremos sumaría un día de más.
// ---------------------------------------------------------------------------

import Pastilla from "@/components/ui/Pastilla";

export type ClaveAtajo = "semana" | "quincena" | "mes" | "trimestre" | "semestre" | "ano";

export interface PeriodoElegido {
  /** `YYYY-MM-DD`; cadena vacía = sin límite (desde el inicio de la obra). */
  desde: string;
  /** `YYYY-MM-DD`; cadena vacía = sin límite (hasta la fecha de corte). */
  hasta: string;
  /** El atajo que produjo el rango, o `null` si se escribió a mano. */
  atajo: ClaveAtajo | null;
}

/** El valor por defecto: sin acotar. Es como se comportaba el informe antes. */
export const PERIODO_COMPLETO: PeriodoElegido = { desde: "", hasta: "", atajo: null };

interface DefinicionAtajo {
  clave: ClaveAtajo;
  etiqueta: string;
  /** Longitud de la ventana. Una de las dos, nunca las dos. */
  dias?: number;
  meses?: number;
}

const ATAJOS: DefinicionAtajo[] = [
  { clave: "semana", etiqueta: "Semana", dias: 7 },
  { clave: "quincena", etiqueta: "Quincena", dias: 15 },
  { clave: "mes", etiqueta: "Mes", meses: 1 },
  { clave: "trimestre", etiqueta: "Trimestre", meses: 3 },
  { clave: "semestre", etiqueta: "Semestre", meses: 6 },
  { clave: "ano", etiqueta: "Año", meses: 12 },
];

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * `YYYY-MM-DD` leído en la hora LOCAL del navegador.
 *
 * `toISOString()` no sirve aquí: convierte a UTC, así que a las 8 de la noche
 * en Bogotá devolvería el día siguiente. El usuario elige días de su
 * calendario, no instantes.
 */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function sumarDias(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Resta meses SIN desbordar el mes de destino.
 *
 * `setMonth(-1)` sobre un 31 de marzo produce el 3 de marzo, porque el 31 de
 * febrero no existe y `Date` lo corre en silencio. Un «último mes» pedido el
 * 31 de marzo devolvería entonces una ventana de tres días. Se fija el día 1
 * antes de mover el mes y luego se recorta al último día que ese mes tenga.
 */
function restarMeses(d: Date, n: number): Date {
  const anio = d.getFullYear();
  const mes = d.getMonth() - n;
  const destino = new Date(anio, mes, 1);
  const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(d.getDate(), ultimoDia));
  return destino;
}

/**
 * Las dos fechas de un atajo. `hoy` entra por parámetro para poder verificarlo
 * sin depender del reloj.
 */
export function rangoDeAtajo(clave: ClaveAtajo, hoy: Date = new Date()): PeriodoElegido {
  const def = ATAJOS.find((a) => a.clave === clave);
  if (!def) return PERIODO_COMPLETO;
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  // Los dos extremos cuentan: una ventana de 7 días que acaba hoy empieza hace
  // seis, no hace siete.
  const inicio = def.dias
    ? sumarDias(fin, -(def.dias - 1))
    : sumarDias(restarMeses(fin, def.meses ?? 0), 1);
  return { desde: isoLocal(inicio), hasta: isoLocal(fin), atajo: clave };
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** `2026-09-14` → «14 de septiembre de 2026». Sin `Date`: es texto, no tiempo. */
function enLetra(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1] ?? ""} de ${m[1]}`;
}

/**
 * La frase que confirma lo elegido. Se enseña SIEMPRE, también cuando no hay
 * período: quien no toca nada tiene que saber que se lleva la historia entera.
 */
export function describirPeriodo(p: PeriodoElegido): string {
  if (p.desde && p.hasta) {
    // Dentro del mismo año el año se escribe una vez, como en la portada del
    // PDF: «Del 15 de agosto al 14 de septiembre de 2026». Las dos frases
    // tienen que coincidir o el usuario cree que pidió otra cosa.
    const inicio =
      p.desde.slice(0, 4) === p.hasta.slice(0, 4)
        ? enLetra(p.desde).replace(/ de \d{4}$/, "")
        : enLetra(p.desde);
    return `Del ${inicio} al ${enLetra(p.hasta)}`;
  }
  if (p.desde) return `Desde el ${enLetra(p.desde)} hasta hoy`;
  if (p.hasta) return `Desde el inicio de la obra hasta el ${enLetra(p.hasta)}`;
  return "Historia completa de la obra, desde su inicio";
}

/** `true` si el rango está al revés y no se puede pedir. */
export function periodoInvalido(p: PeriodoElegido): boolean {
  return Boolean(p.desde && p.hasta && p.desde > p.hasta);
}

export default function SelectorPeriodo({
  valor,
  onCambio,
  deshabilitado = false,
}: {
  valor: PeriodoElegido;
  onCambio: (p: PeriodoElegido) => void;
  deshabilitado?: boolean;
}) {
  const sinPeriodo = !valor.desde && !valor.hasta;
  const invalido = periodoInvalido(valor);

  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-gris mb-2">
        Período del informe
      </p>

      {/* Las pastillas SE PULSAN, así que llevan la sombra dura del sistema.
          El tono azul marca la elegida; el resto van neutras. */}
      <div className="flex flex-wrap gap-2">
        <Pastilla
          accionable
          tono={sinPeriodo ? "azul" : "neutro"}
          aria-pressed={sinPeriodo}
          disabled={deshabilitado}
          onClick={() => onCambio(PERIODO_COMPLETO)}
        >
          Todo
        </Pastilla>
        {ATAJOS.map((a) => {
          const activo = valor.atajo === a.clave;
          return (
            <Pastilla
              key={a.clave}
              accionable
              tono={activo ? "azul" : "neutro"}
              aria-pressed={activo}
              disabled={deshabilitado}
              onClick={() => onCambio(rangoDeAtajo(a.clave))}
            >
              {a.etiqueta}
            </Pastilla>
          );
        })}
      </div>

      {/* Escribir una fecha a mano deja de ser un atajo: se borra la etiqueta
          para que la portada del PDF no diga «último mes» sobre un rango que
          ya no es el último mes. */}
      <div className="flex flex-wrap items-end gap-3 mt-3">
        <CampoFecha
          etiqueta="Desde"
          valor={valor.desde}
          max={valor.hasta || undefined}
          deshabilitado={deshabilitado}
          onCambio={(v) => onCambio({ ...valor, desde: v, atajo: null })}
        />
        <CampoFecha
          etiqueta="Hasta"
          valor={valor.hasta}
          min={valor.desde || undefined}
          deshabilitado={deshabilitado}
          onCambio={(v) => onCambio({ ...valor, hasta: v, atajo: null })}
        />
      </div>

      <p
        className={`text-[11px] mt-2 ${invalido ? "font-semibold text-[var(--rojo-txt)]" : "text-gris"}`}
        role={invalido ? "alert" : undefined}
      >
        {invalido
          ? "La fecha inicial es posterior a la final."
          : describirPeriodo(valor)}
      </p>
    </div>
  );
}

function CampoFecha({
  etiqueta,
  valor,
  min,
  max,
  deshabilitado,
  onCambio,
}: {
  etiqueta: string;
  valor: string;
  min?: string;
  max?: string;
  deshabilitado: boolean;
  onCambio: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gris">
        {etiqueta}
      </span>
      <input
        type="date"
        value={valor}
        min={min}
        max={max}
        disabled={deshabilitado}
        onChange={(e) => onCambio(e.target.value)}
        className="text-xs px-3 py-1.5 rounded-lg border border-gris-bde bg-white text-tinta focus:ring-2 focus:ring-blue-500/30 focus:border-azul cursor-pointer max-w-[190px] disabled:opacity-55 disabled:cursor-not-allowed"
      />
    </label>
  );
}
