"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import PasoOpciones from "./PasoOpciones";
import SelectorUbicacion from "./SelectorUbicacion";
import {
  OPCIONES_CONTROL_ACTUAL,
  OPCIONES_CONTROL_EMPRESA,
  OPCIONES_NUM_CONTRATISTAS,
  OPCIONES_OBRAS_ACTIVAS,
  OPCIONES_OFICIO,
  OPCIONES_PRIMERA_OBRA,
  OPCIONES_TAMANO_EQUIPO,
  OPCIONES_TIENE_CONTRATISTA,
  OPCIONES_TIPO_OBRA,
} from "./opciones";

type TipoCuenta = "CONTRATISTA" | "PROPIETARIO" | "CONSTRUCTORA";

/** Respuestas acumuladas; cada perfil llena solo las suyas. */
interface Respuestas {
  oficio: string | null;
  tamano_equipo: string | null;
  control_actual: string | null;
  primera_obra: string | null; // "SI" | "NO" en UI; se convierte a boolean al enviar
  tiene_contratista: string | null;
  obras_activas: string | null;
  tipo_obra: string | null;
  num_contratistas: string | null;
  departamento: string;
  ciudad: string;
}

const RESPUESTAS_INICIALES: Respuestas = {
  oficio: null,
  tamano_equipo: null,
  control_actual: null,
  primera_obra: null,
  tiene_contratista: null,
  obras_activas: null,
  tipo_obra: null,
  num_contratistas: null,
  departamento: "",
  ciudad: "",
};

/** Número de páginas por perfil. */
function totalPasos(tipo: TipoCuenta): number {
  return tipo === "CONSTRUCTORA" ? 4 : 3;
}

export default function OnboardingWizard({
  tipoCuenta,
  nombreUsuario,
  destino,
}: {
  tipoCuenta: TipoCuenta;
  nombreUsuario: string;
  /** Ruta a la que se entra al terminar/omitir (la decide el server). */
  destino: string;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [r, setR] = useState<Respuestas>(RESPUESTAS_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = totalPasos(tipoCuenta);
  const esUltimo = paso >= total;
  const primerNombre = (nombreUsuario || "").split(" ")[0];

  function set<K extends keyof Respuestas>(key: K, value: Respuestas[K]) {
    setR((prev) => ({ ...prev, [key]: value }));
  }

  // ¿El paso actual permite avanzar? (validación mínima por paso/perfil).
  const puedeAvanzar = useMemo(() => {
    if (tipoCuenta === "CONTRATISTA") {
      if (paso === 1) return r.oficio !== null;
      if (paso === 2) return r.tamano_equipo !== null;
      return true; // paso 3: ubicación + control son omitibles
    }
    if (tipoCuenta === "PROPIETARIO") {
      if (paso === 1) return r.primera_obra !== null && r.tiene_contratista !== null;
      return true; // paso 2 ubicación, paso 3 control: omitibles
    }
    // CONSTRUCTORA
    if (paso === 1) return r.obras_activas !== null && r.tipo_obra !== null;
    if (paso === 2) return r.tamano_equipo !== null && r.num_contratistas !== null;
    return true; // paso 3 ubicación, paso 4 control: omitibles
  }, [tipoCuenta, paso, r]);

  // ¿Tiene sentido ofrecer "Omitir por ahora" en este paso?
  const puedeOmitir = useMemo(() => {
    if (tipoCuenta === "CONTRATISTA") return paso === 3;
    if (tipoCuenta === "PROPIETARIO") return paso >= 2;
    return paso >= 3; // CONSTRUCTORA
  }, [tipoCuenta, paso]);

  /** Construye el payload con solo los campos del perfil que tengan valor. */
  function construirPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (r.departamento) payload.departamento = r.departamento;
    if (r.ciudad) payload.ciudad = r.ciudad;

    if (tipoCuenta === "CONTRATISTA") {
      if (r.oficio) payload.oficio = r.oficio;
      if (r.tamano_equipo) payload.tamano_equipo = r.tamano_equipo;
      if (r.control_actual) payload.control_actual = r.control_actual;
    } else if (tipoCuenta === "PROPIETARIO") {
      if (r.primera_obra !== null) payload.primera_obra = r.primera_obra === "SI";
      if (r.tiene_contratista) payload.tiene_contratista = r.tiene_contratista;
      if (r.control_actual) payload.control_actual = r.control_actual;
    } else {
      if (r.obras_activas) payload.obras_activas = r.obras_activas;
      if (r.tipo_obra) payload.tipo_obra = r.tipo_obra;
      if (r.tamano_equipo) payload.tamano_equipo = r.tamano_equipo;
      if (r.num_contratistas) payload.num_contratistas = r.num_contratistas;
      if (r.control_actual) payload.control_actual = r.control_actual;
    }
    return payload;
  }

  async function finalizar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(construirPayload()),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      }
      router.push(destino);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setEnviando(false);
    }
  }

  function continuar() {
    if (esUltimo) {
      void finalizar();
      return;
    }
    setPaso((p) => Math.min(p + 1, total));
  }

  function atras() {
    setError(null);
    setPaso((p) => Math.max(p - 1, 1));
  }

  // Omitir registra lo respondido hasta ahora y entra (igual que finalizar).
  function omitir() {
    void finalizar();
  }

  const progreso = Math.round((paso / total) * 100);

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-10 sm:py-14 bg-slate-50">
      <div className="w-full max-w-xl">
        {/* Encabezado */}
        <div className="mb-6">
          <p className="text-xs font-medium text-blue-600 mb-1">
            Paso {paso} de {total}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {paso === 1
              ? `Bienvenido${primerNombre ? `, ${primerNombre}` : ""}`
              : "Un par de detalles más"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Con estas respuestas adaptamos la plataforma a tu caso. Solo te tomará un minuto.
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-7">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progreso}%` }}
          />
        </div>

        {/* Contenido del paso */}
        <div className="space-y-6">
          {tipoCuenta === "CONTRATISTA" && (
            <ContratistaPaso paso={paso} r={r} set={set} />
          )}
          {tipoCuenta === "PROPIETARIO" && (
            <PropietarioPaso paso={paso} r={r} set={set} />
          )}
          {tipoCuenta === "CONSTRUCTORA" && (
            <EmpresaPaso paso={paso} r={r} set={set} />
          )}
        </div>

        {error && (
          <div className="mt-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Controles */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={atras}
            disabled={paso === 1 || enviando}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-0 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Atrás
          </button>

          <div className="flex items-center gap-3">
            {puedeOmitir && (
              <button
                type="button"
                onClick={omitir}
                disabled={enviando}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
              >
                Omitir
              </button>
            )}
            <button
              type="button"
              onClick={continuar}
              disabled={!puedeAvanzar || enviando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : esUltimo ? (
                <Check className="w-4 h-4" />
              ) : null}
              {esUltimo ? "Finalizar" : "Continuar"}
              {!esUltimo && !enviando && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subvistas por perfil ────────────────────────────────────────────────────

type SetFn = <K extends keyof Respuestas>(key: K, value: Respuestas[K]) => void;

function ContratistaPaso({
  paso,
  r,
  set,
}: {
  paso: number;
  r: Respuestas;
  set: SetFn;
}) {
  if (paso === 1) {
    return (
      <PasoOpciones
        titulo="¿Cuál es tu oficio o tipo de negocio?"
        opciones={OPCIONES_OFICIO}
        value={r.oficio}
        onSelect={(v) => set("oficio", v)}
        columnas={2}
      />
    );
  }
  if (paso === 2) {
    return (
      <PasoOpciones
        titulo="¿De qué tamaño es tu equipo?"
        opciones={OPCIONES_TAMANO_EQUIPO}
        value={r.tamano_equipo}
        onSelect={(v) => set("tamano_equipo", v)}
      />
    );
  }
  // Paso 3: ubicación + control
  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          ¿Dónde trabajas?
        </h3>
        <SelectorUbicacion
          departamento={r.departamento}
          ciudad={r.ciudad}
          onChange={(loc) => {
            set("departamento", loc.departamento);
            set("ciudad", loc.ciudad);
          }}
        />
      </div>
      <PasoOpciones
        titulo="¿Cómo controlas hoy el trabajo?"
        opciones={OPCIONES_CONTROL_ACTUAL}
        value={r.control_actual}
        onSelect={(v) => set("control_actual", v)}
        columnas={2}
      />
    </>
  );
}

function PropietarioPaso({
  paso,
  r,
  set,
}: {
  paso: number;
  r: Respuestas;
  set: SetFn;
}) {
  if (paso === 1) {
    return (
      <>
        <PasoOpciones
          titulo="¿Es tu primera obra o ya has hecho otras?"
          opciones={OPCIONES_PRIMERA_OBRA}
          value={r.primera_obra}
          onSelect={(v) => set("primera_obra", v)}
          columnas={2}
        />
        <PasoOpciones
          titulo="¿Ya tienes maestro o contratista, o lo estás buscando?"
          opciones={OPCIONES_TIENE_CONTRATISTA}
          value={r.tiene_contratista}
          onSelect={(v) => set("tiene_contratista", v)}
          columnas={2}
        />
      </>
    );
  }
  if (paso === 2) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          ¿Dónde está tu obra?
        </h3>
        <SelectorUbicacion
          departamento={r.departamento}
          ciudad={r.ciudad}
          onChange={(loc) => {
            set("departamento", loc.departamento);
            set("ciudad", loc.ciudad);
          }}
        />
      </div>
    );
  }
  // Paso 3: control
  return (
    <PasoOpciones
      titulo="¿Cómo llevas hoy el control de tu obra?"
      opciones={OPCIONES_CONTROL_ACTUAL}
      value={r.control_actual}
      onSelect={(v) => set("control_actual", v)}
      columnas={2}
    />
  );
}

function EmpresaPaso({
  paso,
  r,
  set,
}: {
  paso: number;
  r: Respuestas;
  set: SetFn;
}) {
  if (paso === 1) {
    return (
      <>
        <PasoOpciones
          titulo="¿Cuántas obras activas manejan actualmente?"
          opciones={OPCIONES_OBRAS_ACTIVAS}
          value={r.obras_activas}
          onSelect={(v) => set("obras_activas", v)}
          columnas={2}
        />
        <PasoOpciones
          titulo="¿Qué tipo de obra construyen principalmente?"
          opciones={OPCIONES_TIPO_OBRA}
          value={r.tipo_obra}
          onSelect={(v) => set("tipo_obra", v)}
          columnas={2}
        />
      </>
    );
  }
  if (paso === 2) {
    return (
      <>
        <PasoOpciones
          titulo="¿De qué tamaño es su equipo?"
          opciones={OPCIONES_TAMANO_EQUIPO}
          value={r.tamano_equipo}
          onSelect={(v) => set("tamano_equipo", v)}
        />
        <PasoOpciones
          titulo="¿Cuántos contratistas manejan?"
          opciones={OPCIONES_NUM_CONTRATISTAS}
          value={r.num_contratistas}
          onSelect={(v) => set("num_contratistas", v)}
        />
      </>
    );
  }
  if (paso === 3) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          ¿Dónde operan principalmente?
        </h3>
        <SelectorUbicacion
          departamento={r.departamento}
          ciudad={r.ciudad}
          onChange={(loc) => {
            set("departamento", loc.departamento);
            set("ciudad", loc.ciudad);
          }}
        />
      </div>
    );
  }
  // Paso 4: control (opcional)
  return (
    <PasoOpciones
      titulo="¿Cómo controlan hoy el avance de sus obras?"
      opciones={OPCIONES_CONTROL_EMPRESA}
      value={r.control_actual}
      onSelect={(v) => set("control_actual", v)}
      columnas={2}
    />
  );
}
