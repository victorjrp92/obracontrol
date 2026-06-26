"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Minus,
  X,
  Copy,
  Pencil,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Sparkles,
  Info,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { TipoCuenta } from "@/generated/prisma";
import {
  TIPOS_OBRA,
  TIPOS_PROPIEDAD,
  ESPACIOS_PERSONAL,
  sugerirTareas,
  type TipoObra,
  type TipoPropiedad,
} from "@/lib/plantillas-personal";
import LocationPicker, { type LocationValue } from "@/components/mapa/LocationPicker";
import {
  IconBox,
  EspacioGlyph,
  ICONO_TIPO_OBRA,
  ICONO_PROPIEDAD,
} from "@/components/personal/icons";
import { crearObraPersonal, editarObraPersonal, type ObraParaEditar } from "./actions";
import { estimarPresupuesto, type EspacioEstim } from "@/lib/estimar-presupuesto";
import type { CrearObraInput, EspacioInput } from "./types";

// ─── Modelo interno del wizard ────────────────────────────────────────────────

let _uid = 0;
const nuevoId = () => `e${++_uid}`;

/**
 * Convierte los espacios precargados (modo edición) al modelo interno del wizard.
 * Marca `cargado: true` para que no se re-sugieran plantillas encima y asigna un
 * `id` fresco a cada espacio. Todas las tareas que vienen de la DB están activas.
 */
function espaciosDesdeInput(espacios: EspacioInput[] | undefined): EspacioW[] {
  return (espacios ?? []).map((e) => ({
    id: nuevoId(),
    nombre: e.nombre,
    metraje: e.metraje,
    cargado: true,
    tareas: (e.tareas ?? []).map((t) => ({
      nombre: t.nombre,
      dias: t.tiempo_acordado_dias,
      on: t.activa,
      precio: t.precio,
    })),
  }));
}

interface TareaW {
  nombre: string;
  dias: number;
  /** true = pendiente (se trackea). false = ya hecho. */
  on: boolean;
  precio?: number;
}

interface EspacioW {
  id: string;
  nombre: string;
  metraje?: number;
  tareas: TareaW[];
  /** Tareas ya cargadas desde plantilla (no recargar al volver). */
  cargado?: boolean;
  /** Costo asignado al espacio (paso 6). */
  costo?: number;
  /** Espacio expandido en el paso de costos. */
  expandido?: boolean;
}

interface PisoW {
  espacios: EspacioW[];
}

interface TipoAptoW {
  nombre: string;
  cantidadPorPiso?: number;
  espacios: EspacioW[];
}

type PuntoPartida = "NUEVA" | "MEDIAS" | "AVANZADA";

const PUNTOS_PARTIDA: { key: PuntoPartida; titulo: string; desc: string }[] = [
  { key: "NUEVA", titulo: "Aún no ha iniciado", desc: "Todavía no se ha ejecutado ninguna tarea." },
  { key: "MEDIAS", titulo: "En proceso", desc: "Hay trabajos terminados y otros pendientes." },
  { key: "AVANZADA", titulo: "Próxima a finalizar", desc: "Falta poco para completarla." },
];

// Espacios "singulares" que se prenden/apagan con toggle (uno por piso).
const ESPACIOS_TOGGLE = ESPACIOS_PERSONAL.filter(
  (e) => !["bano", "habitacion", "otro"].includes(e.key),
);

const TOTAL_PASOS = 6; // pasos 1..6 (índices 0..5) + pantalla final (índice 6)

// Bandera de "primera vez" para el mensaje guía del paso "¿Qué te falta?".
// Si ya está en localStorage, no mostramos los mensajes contextuales.
const LS_QFALTA_VISTO = "seiricon_b2c_qfalta_visto";

// ─── Helpers de costos / días ─────────────────────────────────────────────────

function diasHabilesEntre(inicio?: string, fin?: string): number | null {
  if (!inicio || !fin) return null;
  const a = new Date(inicio);
  const b = new Date(fin);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return null;
  let dias = 0;
  const cur = new Date(a);
  while (cur <= b) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) dias++;
    cur.setDate(cur.getDate() + 1);
  }
  return dias;
}

/** Reparte `total` ponderado por `pesos`, redondeando y cuadrando el residuo. */
function repartirPonderado(total: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const suma = pesos.reduce((a, b) => a + b, 0) || n;
  const base = pesos.map((p) => Math.floor((total * (p || (suma === n ? 1 : 0))) / suma));
  // Si todos los pesos eran 0, repartir parejo.
  if (pesos.every((p) => p === 0)) {
    const parejo = Math.floor(total / n);
    const out = Array(n).fill(parejo);
    let resto = total - parejo * n;
    for (let i = 0; i < n && resto > 0; i++, resto--) out[i]++;
    return out;
  }
  let resto = total - base.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n && resto > 0; i++, resto--) base[i]++;
  return base;
}

const fmtCOP = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

// ─── Componente ────────────────────────────────────────────────────────────────

export default function IntentWizard({
  tipoCuenta,
  nombreUsuario,
  tituloInicial,
  modo = "crear",
  initial,
}: {
  tipoCuenta: TipoCuenta;
  nombreUsuario: string;
  tituloInicial: string;
  subtituloInicial: string;
  /** "crear" (default) o "editar" una obra personal ya existente. */
  modo?: "crear" | "editar";
  /** Obra precargada para el modo edición (forma del wizard + proyectoId/estado). */
  initial?: ObraParaEditar;
}) {
  const router = useRouter();
  const esContratista = tipoCuenta === "CONTRATISTA";
  const esEdicion = modo === "editar" && !!initial;
  const primerNombre = nombreUsuario.split(" ")[0];

  // En edición arrancamos en el primer paso ya con todo precargado.
  const [paso, setPaso] = useState(0);

  // Paso 1
  const [tipoObra, setTipoObra] = useState<TipoObra | null>(initial?.tipoObra ?? null);
  // `puntoPartida` no se persiste en la obra: en modo edición arrancamos con un
  // default seguro ("MEDIAS" = en proceso) para no bloquear el paso 0 (que exige
  // un valor no-nulo para avanzar). En creación arranca en null como siempre.
  const [puntoPartida, setPuntoPartida] = useState<PuntoPartida | null>(
    initial?.puntoPartida ?? (modo === "editar" ? "MEDIAS" : null),
  );

  // Paso 2
  const [tipoPropiedad, setTipoPropiedad] = useState<TipoPropiedad | null>(initial?.tipoPropiedad ?? null);
  const [nombreObra, setNombreObra] = useState(initial?.nombreObra ?? "");
  const [clienteNombre, setClienteNombre] = useState(initial?.clienteNombre ?? "");

  // Paso 3 — estructura (uno de los dos según tipo)
  const [pisos, setPisos] = useState<PisoW[]>(() =>
    initial?.pisos?.length
      ? initial.pisos.map((p) => ({ espacios: espaciosDesdeInput(p.espacios) }))
      : [{ espacios: [] }],
  );
  const [edifNumPisos, setEdifNumPisos] = useState(initial?.edificio?.numPisos ?? 4);
  const [edifAptosPorPiso, setEdifAptosPorPiso] = useState(initial?.edificio?.aptosPorPiso ?? 2);
  const [edifUsaDireccion, setEdifUsaDireccion] = useState(initial?.edificio?.usaDireccion ?? false);
  const [tipos, setTipos] = useState<TipoAptoW[]>(() =>
    initial?.edificio?.tipos?.length
      ? initial.edificio.tipos.map((t) => ({
          nombre: t.nombre,
          cantidadPorPiso: t.cantidadPorPiso,
          espacios: espaciosDesdeInput(t.espacios),
        }))
      : [{ nombre: "Tipo A", espacios: [] }],
  );

  // Paso 3 — área de la obra. Dos modos:
  //   "total"   → un solo input de m² de toda la obra (→ metrajeTotal).
  //   "espacio" → m² por espacio (campos individuales, como siempre).
  // Default: "total" para CASA/APARTAMENTO/LOCAL (el dueño suele saber el área
  // total); "espacio" para EDIFICIO (más detallado, por tipo de apartamento).
  const [modoMetraje, setModoMetraje] = useState<"total" | "espacio">(() => {
    if (!initial) return "total";
    // En edición: si la obra guardó metraje total → modo "total"; si hay metraje
    // por espacio → "espacio"; si no hay nada, sigue la heurística del tipo.
    if (initial.metrajeTotal != null && initial.metrajeTotal > 0) return "total";
    const espacios =
      initial.tipoPropiedad === "EDIFICIO"
        ? (initial.edificio?.tipos ?? []).flatMap((t) => t.espacios ?? [])
        : (initial.pisos ?? []).flatMap((p) => p.espacios ?? []);
    if (espacios.some((e) => e.metraje != null && e.metraje > 0)) return "espacio";
    return initial.tipoPropiedad === "EDIFICIO" ? "espacio" : "total";
  });
  // ¿El usuario tocó el toggle de área a mano? Si no, el default sigue al tipo.
  // En edición lo marcamos como "tocado" para respetar el modo inferido del dato.
  const [modoMetrajeTocado, setModoMetrajeTocado] = useState(modo === "editar");
  const [metrajeTotal, setMetrajeTotal] = useState<number | "">(
    initial?.metrajeTotal != null && initial.metrajeTotal > 0 ? initial.metrajeTotal : "",
  );

  // Al elegir el tipo de propiedad fijamos el modo de área recomendado (salvo que
  // el usuario ya lo haya cambiado a mano): EDIFICIO → por espacio; resto → total.
  function seleccionarPropiedad(p: TipoPropiedad) {
    setTipoPropiedad(p);
    if (!modoMetrajeTocado) setModoMetraje(p === "EDIFICIO" ? "espacio" : "total");
  }
  function cambiarModoMetraje(modo: "total" | "espacio") {
    setModoMetrajeTocado(true);
    setModoMetraje(modo);
  }

  // Paso 4 — cuándo y dónde
  const [fechaInicio, setFechaInicio] = useState(initial?.fechaInicio ?? "");
  const [fechaFin, setFechaFin] = useState(initial?.fechaFin ?? "");
  const [ubicacion, setUbicacion] = useState<LocationValue | null>(() =>
    initial?.ubicacionLat != null && initial?.ubicacionLng != null
      ? {
          lat: initial.ubicacionLat,
          lng: initial.ubicacionLng,
          ...(initial.ciudad ? { direccion: initial.ciudad } : {}),
        }
      : null,
  );

  // Paso 6 — costos
  const [presupuestoTotal, setPresupuestoTotal] = useState<number | "">(
    initial?.presupuestoTotal != null && initial.presupuestoTotal > 0 ? initial.presupuestoTotal : "",
  );
  // Para no pisar ediciones manuales de costo/días al re-entrar al paso de costos.
  // En edición arranca en true: los días/precios vienen de la obra guardada y no
  // queremos repartirlos automáticamente encima (el usuario puede re-sugerir).
  const [repartoHecho, setRepartoHecho] = useState(modo === "editar");
  // Cargando sugerencias de tareas con IA (DeepSeek) al entrar a "¿qué falta?".
  const [iaCargando, setIaCargando] = useState(false);
  // Fuente de las últimas sugerencias: "ia" | "sin_key" | "error" | null.
  const [iaFuente, setIaFuente] = useState<"ia" | "sin_key" | "error" | null>(null);
  // Calculando presupuesto con IA al pulsar "Sugerir presupuesto".
  const [presupuestoCargando, setPresupuestoCargando] = useState(false);
  // Resultado del último "Sugerir presupuesto" (para mostrar rango y cobertura).
  const [estimNota, setEstimNota] = useState<
    { total: number; min: number; max: number; sinDato: number; fuente: "ia" | "base" } | null
  >(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);

  // Paso "¿Qué te falta?": mensajes guía de primera vez (dismissibles).
  // Por defecto false (SSR-safe); en cliente se activa solo si nunca se han visto.
  const [ayudaQFalta, setAyudaQFalta] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_QFALTA_VISTO)) setAyudaQFalta(true);
    } catch {
      // Sin acceso a localStorage (modo privado, etc.): no mostramos la guía.
    }
  }, []);
  function descartarAyudaQFalta() {
    setAyudaQFalta(false);
    try {
      localStorage.setItem(LS_QFALTA_VISTO, "1");
    } catch {
      // Ignorar: la guía simplemente reaparecería en una sesión futura.
    }
  }

  const esEdificio = tipoPropiedad === "EDIFICIO";
  const esApto = tipoPropiedad === "APARTAMENTO";
  const tipoObraSafe: TipoObra = tipoObra ?? "REFORMA";

  // ── Acceso uniforme a la lista de "grupos de espacios" según el modo ─────────
  // CASA/LOCAL → un grupo por piso. APTO → un grupo (1 piso). EDIFICIO → un grupo por tipo.
  type Grupo = { titulo: string; espacios: EspacioW[] };
  const grupos: Grupo[] = useMemo(() => {
    if (esEdificio) {
      return tipos.map((t) => ({ titulo: t.nombre || "Tipo de apartamento", espacios: t.espacios }));
    }
    const multi = pisos.length > 1;
    return pisos.map((p, i) => ({
      titulo: multi ? ordinalPiso(i + 1) : "",
      espacios: p.espacios,
    }));
  }, [esEdificio, tipos, pisos]);

  const todosEspacios = useMemo(() => grupos.flatMap((g) => g.espacios), [grupos]);

  // ── Navegación ──────────────────────────────────────────────────────────────
  const puedeAvanzar = useMemo(() => {
    if (paso === 0) return tipoObra !== null && puntoPartida !== null;
    if (paso === 1) return tipoPropiedad !== null && nombreObra.trim().length >= 2;
    if (paso === 2) return todosEspacios.length > 0;
    if (paso === 3) return true; // fechas/ubicación opcionales
    if (paso === 4) return todosEspacios.some((e) => e.tareas.some((t) => t.on));
    if (paso === 5) return true;
    return true;
  }, [paso, tipoObra, puntoPartida, tipoPropiedad, nombreObra, todosEspacios]);

  // Carga sugerencias de tareas para los espacios que aún no las tienen.
  // Tareas estáticas (fallback determinista) para un espacio.
  const tareasEstaticas = useCallback(
    (nombre: string): TareaW[] =>
      sugerirTareas(nombre, tipoObraSafe).map((t) => ({
        nombre: t.nombre,
        dias: t.tiempo_acordado_dias,
        on: true,
      })),
    [tipoObraSafe],
  );

  /**
   * Carga las tareas sugeridas al entrar a "¿qué falta?". Intenta primero la IA
   * (DeepSeek vía /api/sugerencias/tareas) para que las sugerencias sean
   * RELEVANTES a cada espacio; si la IA no está disponible o falla, cae a las
   * plantillas estáticas. Solo carga espacios que aún no estén `cargado` (no
   * pisa lo que el usuario ya ajustó si vuelve atrás, ni la obra en edición).
   */
  async function cargarTareasParaQFalta() {
    if (esEdicion) return; // en edición las tareas vienen de la obra
    const pendientes = todosEspacios.filter((e) => !e.cargado);
    if (pendientes.length === 0) return;

    const nombres = Array.from(
      new Set(pendientes.map((e) => e.nombre.trim()).filter(Boolean)),
    );

    setIaCargando(true);
    let mapa: Record<string, { nombre: string; dias: number }[]> | null = null;
    try {
      const res = await fetch("/api/sugerencias/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          espacios: nombres,
          tipoObra: tipoObraSafe,
          tipoPropiedad,
          ciudad: ciudadDesde(ubicacion?.direccion),
          puntoPartida,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        mapa = j?.sugerencias ?? null;
        setIaFuente(j?.fuente ?? "error");
      } else {
        setIaFuente("error");
      }
    } catch {
      mapa = null; // sin IA → fallback estático
      setIaFuente("error");
    }

    const aplicar = (espacios: EspacioW[]): EspacioW[] =>
      espacios.map((e) => {
        if (e.cargado) return e;
        const ia = mapa?.[e.nombre.trim()];
        const tareas: TareaW[] =
          ia && ia.length
            ? ia.map((t) => ({ nombre: t.nombre, dias: t.dias, on: true }))
            : tareasEstaticas(e.nombre);
        return { ...e, tareas, cargado: true };
      });

    if (esEdificio) setTipos((prev) => prev.map((t) => ({ ...t, espacios: aplicar(t.espacios) })));
    else setPisos((prev) => prev.map((p) => ({ espacios: aplicar(p.espacios) })));
    setIaCargando(false);
  }

  function avanzar() {
    setError("");
    // Al entrar al paso "qué falta", prellenar tareas sugeridas (IA + fallback).
    if (paso === 3) {
      void cargarTareasParaQFalta();
    }
    // Al entrar a costos, repartir presupuesto + días — solo la primera vez,
    // para no borrar lo que el usuario haya ajustado a mano si vuelve atrás.
    if (paso === 4 && !repartoHecho) {
      aplicarReparto();
      setRepartoHecho(true);
    }
    setPaso((p) => Math.min(p + 1, TOTAL_PASOS));
  }

  function retroceder() {
    setError("");
    setPaso((p) => Math.max(p - 1, 0));
  }

  // ── Mutadores de estructura (CASA/LOCAL/APTO) ───────────────────────────────
  function setEspaciosDePiso(idx: number, fn: (e: EspacioW[]) => EspacioW[]) {
    setPisos((prev) =>
      prev.map((p, i) => (i === idx ? { espacios: fn(p.espacios.map((e) => ({ ...e }))) } : p)),
    );
  }
  function cambiarNumPisos(delta: number) {
    setPisos((prev) => {
      const objetivo = Math.max(1, Math.min(10, prev.length + delta));
      if (objetivo === prev.length) return prev;
      if (objetivo > prev.length) {
        const extra = Array.from({ length: objetivo - prev.length }, () => ({ espacios: [] as EspacioW[] }));
        return [...prev, ...extra];
      }
      return prev.slice(0, objetivo);
    });
  }
  function copiarPisoAnterior(idx: number) {
    setPisos((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              espacios: prev[idx - 1].espacios.map((e) => ({
                ...e,
                id: nuevoId(),
                tareas: e.tareas.map((t) => ({ ...t })),
                cargado: false,
              })),
            }
          : p,
      ),
    );
  }

  // ── Mutadores de estructura (EDIFICIO / tipos de apto) ──────────────────────
  function setEspaciosDeTipo(idx: number, fn: (e: EspacioW[]) => EspacioW[]) {
    setTipos((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, espacios: fn(t.espacios.map((e) => ({ ...e }))) } : t)),
    );
  }
  function agregarTipo() {
    setTipos((prev) => {
      const letra = String.fromCharCode("A".charCodeAt(0) + prev.length);
      return [...prev, { nombre: `Tipo ${letra}`, espacios: [] }];
    });
  }
  function quitarTipo(idx: number) {
    setTipos((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  // ── Operaciones genéricas sobre una lista de espacios ───────────────────────
  // (reusadas tanto para pisos como para tipos)
  function setContador(espacios: EspacioW[], baseLabel: string, nuevoCount: number): EspacioW[] {
    const actuales = espacios.filter((e) => e.nombre.startsWith(baseLabel));
    const otros = espacios.filter((e) => !e.nombre.startsWith(baseLabel));
    const count = Math.max(0, Math.min(20, nuevoCount));
    const resultado: EspacioW[] = [];
    for (let i = 0; i < count; i++) {
      const existente = actuales[i];
      resultado.push(
        existente ?? {
          id: nuevoId(),
          nombre: count === 1 ? baseLabel : `${baseLabel} ${i + 1}`,
          tareas: [],
        },
      );
    }
    // Renombrar si pasó de 1 a varios o viceversa, solo si no fue editado a mano.
    return [...otros, ...resultado];
  }

  function toggleEspacioSingular(espacios: EspacioW[], label: string): EspacioW[] {
    const existe = espacios.find((e) => e.nombre === label);
    if (existe) return espacios.filter((e) => e.id !== existe.id);
    return [...espacios, { id: nuevoId(), nombre: label, tareas: [] }];
  }

  function renombrarEspacio(espacios: EspacioW[], id: string, nombre: string): EspacioW[] {
    return espacios.map((e) => (e.id === id ? { ...e, nombre } : e));
  }
  function setMetraje(espacios: EspacioW[], id: string, metraje?: number): EspacioW[] {
    return espacios.map((e) => (e.id === id ? { ...e, metraje } : e));
  }

  // Cuenta cuántos espacios de cierto prefijo hay (para los steppers).
  function contar(espacios: EspacioW[], baseLabel: string): number {
    return espacios.filter((e) => e.nombre.startsWith(baseLabel)).length;
  }

  // ── Tareas (paso 5) ─────────────────────────────────────────────────────────
  function mutarEspacioPorId(id: string, fn: (e: EspacioW) => EspacioW) {
    if (esEdificio) {
      setTipos((prev) =>
        prev.map((t) => ({ ...t, espacios: t.espacios.map((e) => (e.id === id ? fn({ ...e }) : e)) })),
      );
    } else {
      setPisos((prev) =>
        prev.map((p) => ({ espacios: p.espacios.map((e) => (e.id === id ? fn({ ...e }) : e)) })),
      );
    }
  }
  function toggleTarea(espId: string, idx: number) {
    mutarEspacioPorId(espId, (e) => ({
      ...e,
      tareas: e.tareas.map((t, i) => (i === idx ? { ...t, on: !t.on } : t)),
    }));
  }
  function agregarTareaManual(espId: string, nombre: string) {
    const v = nombre.trim();
    if (!v) return;
    mutarEspacioPorId(espId, (e) => ({
      ...e,
      tareas: [...e.tareas, { nombre: v, dias: 1, on: true }],
    }));
  }
  // Elimina del todo una tarea sugerida que no aplica (no solo la desmarca).
  function eliminarTarea(espId: string, idx: number) {
    mutarEspacioPorId(espId, (e) => ({
      ...e,
      tareas: e.tareas.filter((_, i) => i !== idx),
    }));
  }
  function cambiarDiasTarea(espId: string, idx: number, dias: number) {
    mutarEspacioPorId(espId, (e) => ({
      ...e,
      tareas: e.tareas.map((t, i) => (i === idx ? { ...t, dias: Math.max(1, dias || 1) } : t)),
    }));
  }
  function cambiarPrecioTarea(espId: string, idx: number, precio?: number) {
    mutarEspacioPorId(espId, (e) => ({
      ...e,
      tareas: e.tareas.map((t, i) => (i === idx ? { ...t, precio } : t)),
    }));
  }

  // ── Reparto de costos y días (paso 6) ───────────────────────────────────────
  const plazoDias = useMemo(() => diasHabilesEntre(fechaInicio, fechaFin), [fechaInicio, fechaFin]);

  /**
   * Reparte costo del presupuesto y días del plazo entre espacios/tareas
   * activas. CLAVE: el reparto es GLOBAL — el total se distribuye una sola vez
   * entre todos los espacios activos de todos los pisos/tipos (no por grupo,
   * que multiplicaba el presupuesto por la cantidad de pisos).
   */
  function repartirGlobal(soloDistribuyeDias = false) {
    const total = soloDistribuyeDias ? 0 : (typeof presupuestoTotal === "number" ? presupuestoTotal : 0);
    const plazo = diasHabilesEntre(fechaInicio, fechaFin);

    const gruposActuales: EspacioW[][] = esEdificio
      ? tipos.map((t) => t.espacios)
      : pisos.map((p) => p.espacios);

    // Pesos de días (todas las tareas activas en orden) + conteo de espacios activos.
    const pesosDias: number[] = [];
    let numEspaciosActivos = 0;
    gruposActuales.forEach((espacios) =>
      espacios.forEach((e) => {
        if (e.tareas.some((t) => t.on)) numEspaciosActivos++;
        e.tareas.forEach((t) => t.on && pesosDias.push(t.dias || 1));
      }),
    );

    const diasGlobal =
      plazo && plazo > 0 ? repartirPonderado(plazo, pesosDias).map((d) => Math.max(1, d)) : [];
    const costosGlobal =
      total > 0 ? repartirPonderado(total, Array(numEspaciosActivos).fill(1)) : [];

    let gi = 0; // índice global de tarea activa (días)
    let ci = 0; // índice global de espacio activo (costo)
    const repartir = (espacios: EspacioW[]): EspacioW[] =>
      espacios.map((e) => {
        const tieneActivas = e.tareas.some((t) => t.on);
        const costoEsp = tieneActivas && total > 0 ? costosGlobal[ci++] : e.costo;
        const tareas = e.tareas.map((t) => {
          if (!t.on) return t;
          const dias = diasGlobal.length ? diasGlobal[gi++] : t.dias;
          return { ...t, dias };
        });
        return { ...e, costo: costoEsp, tareas };
      });

    if (esEdificio) setTipos((prev) => prev.map((t) => ({ ...t, espacios: repartir(t.espacios) })));
    else setPisos((prev) => prev.map((p) => ({ ...p, espacios: repartir(p.espacios) })));
  }

  function aplicarReparto() {
    repartirGlobal();
  }

  /**
   * Estimador DETERMINISTA (base semilla, solo mano de obra). Es el respaldo
   * si la IA no está disponible. Aplica costos y devuelve el resultado.
   */
  function sugerirPresupuestoDeterminista() {
    const espaciosEstim: EspacioEstim[] = todosEspacios.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      metraje: e.metraje,
      tareas: e.tareas.map((t) => ({ nombre: t.nombre, dias: t.dias, on: t.on })),
    }));
    const res = estimarPresupuesto(espaciosEstim, {
      ciudad: ciudadDesde(ubicacion?.direccion),
      areaTotal:
        modoMetraje === "total" && typeof metrajeTotal === "number" && metrajeTotal > 0
          ? metrajeTotal
          : undefined,
    });
    const porId = new Map(res.espacios.map((e) => [e.id, e]));
    const aplicar = (espacios: EspacioW[]): EspacioW[] =>
      espacios.map((e) => {
        const est = porId.get(e.id);
        if (!est) return e;
        let k = 0;
        const tareas = e.tareas.map((t) => {
          if (!t.on) return t;
          const et = est.tareas[k++];
          return et ? { ...t, precio: et.costo } : t;
        });
        return { ...e, costo: est.costo, tareas };
      });
    if (esEdificio) setTipos((prev) => prev.map((t) => ({ ...t, espacios: aplicar(t.espacios) })));
    else setPisos((prev) => prev.map((p) => ({ ...p, espacios: aplicar(p.espacios) })));
    setPresupuestoTotal(res.total);
    setRepartoHecho(true);
    setEstimNota({ total: res.total, min: res.min, max: res.max, sinDato: res.sinDato, fuente: "base" });
  }

  /**
   * "Sugerir presupuesto": pide a DeepSeek el COSTO TOTAL (mano de obra +
   * materiales) por tarea, ANCLADO en la base semilla de precios de Colombia.
   * Si la IA no está disponible, cae al estimador determinista (solo M.O.).
   */
  async function sugerirPresupuesto() {
    // Mapa índice global → (espacioId, posición de la tarea en el espacio).
    const ref: { espacioId: string; taskIdx: number }[] = [];
    const items: { i: number; espacio: string; tarea: string; dias: number; metraje?: number }[] = [];
    todosEspacios.forEach((e) => {
      e.tareas.forEach((t, idx) => {
        if (!t.on) return;
        const i = ref.length;
        items.push({ i, espacio: e.nombre, tarea: t.nombre, dias: t.dias, metraje: e.metraje });
        ref.push({ espacioId: e.id, taskIdx: idx });
      });
    });
    if (items.length === 0) return;

    setPresupuestoCargando(true);
    let precios: Record<number, number> | null = null;
    try {
      const res = await fetch("/api/sugerencias/presupuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tareas: items,
          tipoObra: tipoObraSafe,
          tipoPropiedad,
          ciudad: ciudadDesde(ubicacion?.direccion),
        }),
      });
      if (res.ok) {
        const j = await res.json();
        precios = j?.precios ?? null;
      }
    } catch {
      precios = null;
    }

    if (!precios) {
      // Sin IA → respaldo determinista (base semilla, solo mano de obra).
      sugerirPresupuestoDeterminista();
      setPresupuestoCargando(false);
      return;
    }

    // Aplica los precios de la IA por (espacioId, posición de tarea).
    const clave = (eid: string, idx: number) => `${eid}:${idx}`;
    const mp = new Map<string, number>();
    let total = 0;
    ref.forEach((r, i) => {
      const p = precios![i];
      if (typeof p === "number" && p >= 0) {
        mp.set(clave(r.espacioId, r.taskIdx), p);
        total += p;
      }
    });

    const aplicar = (espacios: EspacioW[]): EspacioW[] =>
      espacios.map((e) => {
        let costo = 0;
        const tareas = e.tareas.map((t, idx) => {
          if (!t.on) return t;
          const p = mp.get(clave(e.id, idx));
          if (typeof p === "number") {
            costo += p;
            return { ...t, precio: p };
          }
          return t;
        });
        return { ...e, costo: costo || e.costo, tareas };
      });
    if (esEdificio) setTipos((prev) => prev.map((t) => ({ ...t, espacios: aplicar(t.espacios) })));
    else setPisos((prev) => prev.map((p) => ({ ...p, espacios: aplicar(p.espacios) })));

    setPresupuestoTotal(total);
    setRepartoHecho(true);
    setEstimNota({
      total,
      min: Math.round(total * 0.8),
      max: Math.round(total * 1.25),
      sinDato: 0,
      fuente: "ia",
    });
    setPresupuestoCargando(false);
  }

  function setCostoEspacio(id: string, costo?: number) {
    mutarEspacioPorId(id, (e) => ({ ...e, costo }));
  }
  function toggleExpandido(id: string) {
    mutarEspacioPorId(id, (e) => ({ ...e, expandido: !e.expandido }));
  }

  // Cuando el usuario cambia el total a mano, redistribuir el costo global.
  function onCambiarTotal(v: string) {
    const num = v === "" ? "" : Math.max(0, parseInt(v.replace(/\D/g, "")) || 0);
    setPresupuestoTotal(num);
    const total = typeof num === "number" ? num : 0;

    const gruposActuales: EspacioW[][] = esEdificio
      ? tipos.map((t) => t.espacios)
      : pisos.map((p) => p.espacios);
    let numEspaciosActivos = 0;
    gruposActuales.forEach((espacios) =>
      espacios.forEach((e) => { if (e.tareas.some((t) => t.on)) numEspaciosActivos++; }),
    );
    const costosGlobal = total > 0 ? repartirPonderado(total, Array(numEspaciosActivos).fill(1)) : [];

    let ci = 0;
    const repartir = (espacios: EspacioW[]): EspacioW[] =>
      espacios.map((e) => {
        const tieneActivas = e.tareas.some((t) => t.on);
        return { ...e, costo: tieneActivas && total > 0 ? costosGlobal[ci++] : undefined };
      });
    if (esEdificio) setTipos((prev) => prev.map((t) => ({ ...t, espacios: repartir(t.espacios) })));
    else setPisos((prev) => prev.map((p) => ({ ...p, espacios: repartir(p.espacios) })));
  }

  const sumaCostosEspacios = useMemo(
    () => todosEspacios.reduce((acc, e) => acc + (e.costo ?? 0), 0),
    [todosEspacios],
  );
  const totalDias = useMemo(
    () => todosEspacios.reduce((acc, e) => acc + e.tareas.filter((t) => t.on).reduce((a, t) => a + t.dias, 0), 0),
    [todosEspacios],
  );
  const totalTareasActivas = useMemo(
    () => todosEspacios.reduce((acc, e) => acc + e.tareas.filter((t) => t.on).length, 0),
    [todosEspacios],
  );

  // ── Crear ─────────────────────────────────────────────────────────────────
  async function crear() {
    setEnviando(true);
    setError("");
    setLimiteAlcanzado(false);

    const mapEspacios = (espacios: EspacioW[]) =>
      espacios
        .filter((e) => e.nombre.trim())
        .map((e) => {
          const activas = e.tareas.filter((t) => t.on);
          // Reparto de costo del espacio entre sus tareas activas, ponderado por días.
          const precios =
            e.costo && activas.length
              ? repartirPonderado(e.costo, activas.map((t) => t.dias || 1))
              : [];
          let pi = 0;
          return {
            nombre: e.nombre.trim(),
            metraje: e.metraje && e.metraje > 0 ? e.metraje : undefined,
            tareas: e.tareas.map((t) => ({
              nombre: t.nombre,
              tiempo_acordado_dias: t.dias,
              precio: t.on ? (t.precio ?? (precios.length ? precios[pi++] : undefined)) : undefined,
              activa: t.on,
            })),
          };
        });

    const base: CrearObraInput = {
      tipoObra: tipoObraSafe,
      puntoPartida: puntoPartida ?? undefined,
      tipoPropiedad: tipoPropiedad!,
      nombreObra: nombreObra.trim(),
      clienteNombre: esContratista ? clienteNombre.trim() || undefined : undefined,
      fechaInicio: fechaInicio || undefined,
      fechaFin: fechaFin || undefined,
      ubicacionLat: ubicacion?.lat ?? null,
      ubicacionLng: ubicacion?.lng ?? null,
      // La ciudad se deriva de la dirección del picker. En edición, si el picker
      // no aporta dirección legible (p.ej. coords precargadas), conservamos la
      // ciudad original para no borrarla al guardar.
      ciudad: ciudadDesde(ubicacion?.direccion) ?? (esEdicion ? initial?.ciudad : undefined),
      presupuestoTotal: typeof presupuestoTotal === "number" && presupuestoTotal > 0 ? presupuestoTotal : undefined,
      // m² de toda la obra: solo si el usuario eligió ese modo y dio un valor.
      metrajeTotal:
        modoMetraje === "total" && typeof metrajeTotal === "number" && metrajeTotal > 0
          ? metrajeTotal
          : undefined,
    };

    const input: CrearObraInput = esEdificio
      ? {
          ...base,
          edificio: {
            numPisos: edifNumPisos,
            aptosPorPiso: edifAptosPorPiso,
            usaDireccion: edifUsaDireccion || undefined,
            tipos: tipos.map((t) => ({
              nombre: t.nombre.trim() || "Tipo",
              cantidadPorPiso: t.cantidadPorPiso,
              espacios: mapEspacios(t.espacios),
            })),
          },
        }
      : {
          ...base,
          pisos: pisos.map((p, i) => ({ numero: i + 1, espacios: mapEspacios(p.espacios) })),
        };

    const res =
      esEdicion && initial
        ? await editarObraPersonal(initial.proyectoId, input)
        : await crearObraPersonal(input);
    if (res.ok) {
      router.push(`/dashboard/proyectos/${res.proyectoId}`);
      return;
    }
    setError(res.error);
    setLimiteAlcanzado(!!res.limiteAlcanzado);
    setEnviando(false);
  }

  const titulosPaso = [
    "¿Qué vas a hacer y cómo va?",
    "¿Qué tipo de propiedad?",
    "Configura tu obra",
    "¿Cuándo y dónde?",
    "¿Qué te falta por hacer?",
    "Costos",
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        {/* Encabezado */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-3 py-1 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> {esEdicion ? "Editando tu obra" : "Tu obra, bajo control"}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {paso === 0
              ? esEdicion
                ? `Editar ${initial?.nombreObra ?? "tu obra"}`
                : `Hola ${primerNombre}`
              : titulosPaso[paso] ?? tituloInicial}
          </h1>
          {paso === 0 && (
            <p className="text-sm text-slate-500 mt-1">
              {esEdicion
                ? "Ajusta lo que necesites. Tus cambios se guardan al final."
                : "Configuraremos tu obra en unos pasos. Tú decides."}
            </p>
          )}
        </div>

        {/* Progreso */}
        {paso < TOTAL_PASOS && (
          <div className="flex items-center gap-1.5 mb-6">
            {Array.from({ length: TOTAL_PASOS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-colors ${i <= paso ? "bg-blue-600" : "bg-slate-200"}`}
              />
            ))}
          </div>
        )}

        {error && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl border text-sm ${
              limiteAlcanzado ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {error}
          </div>
        )}

        {/* ── Paso 1: ¿Qué y cómo va? ───────────────────────────────────── */}
        {paso === 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-700">¿Qué quieres hacer?</p>
              {TIPOS_OBRA.map((t) => (
                <BigCard
                  key={t.key}
                  Icon={ICONO_TIPO_OBRA[t.key]}
                  titulo={t.titulo}
                  desc={t.desc}
                  activo={tipoObra === t.key}
                  onClick={() => setTipoObra(t.key)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-700">¿Cómo va la obra hoy?</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PUNTOS_PARTIDA.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPuntoPartida(p.key)}
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      puntoPartida === p.key
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 text-sm">{p.titulo}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Paso 2: Propiedad ─────────────────────────────────────────── */}
        {paso === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">¿Dónde es la obra?</p>
              <div className="grid grid-cols-2 gap-3">
                {TIPOS_PROPIEDAD.map((p) => (
                  <ChipPropiedad
                    key={p.key}
                    Icon={ICONO_PROPIEDAD[p.key]}
                    label={p.label}
                    activo={tipoPropiedad === p.key}
                    onClick={() => seleccionarPropiedad(p.key)}
                  />
                ))}
              </div>
            </div>

            {esContratista && (
              <Campo
                label="¿Para qué cliente? (opcional)"
                placeholder="Ej: Familia Gómez"
                value={clienteNombre}
                onChange={setClienteNombre}
              />
            )}

            <Campo
              label="Asígnale un nombre a la obra"
              placeholder={esContratista ? "Ej: Remodelación apto Gómez" : "Ej: Remodelación de mi casa"}
              value={nombreObra}
              onChange={setNombreObra}
            />
          </div>
        )}

        {/* ── Paso 3: Arma tu obra ──────────────────────────────────────── */}
        {paso === 2 && tipoPropiedad && (
          <div className="flex flex-col gap-4">
            <AreaObra
              modo={modoMetraje}
              metrajeTotal={metrajeTotal}
              recomendadoPorEspacio={esEdificio}
              onModo={cambiarModoMetraje}
              onMetrajeTotal={setMetrajeTotal}
            />
            {esEdificio ? (
              <EdificioBuilder
                numPisos={edifNumPisos}
                aptosPorPiso={edifAptosPorPiso}
                usaDireccion={edifUsaDireccion}
                tipos={tipos}
                onNumPisos={setEdifNumPisos}
                onAptosPorPiso={setEdifAptosPorPiso}
                onUsaDireccion={setEdifUsaDireccion}
                onAgregarTipo={agregarTipo}
                onQuitarTipo={quitarTipo}
                onRenombrarTipo={(i, n) => setTipos((prev) => prev.map((t, j) => (j === i ? { ...t, nombre: n } : t)))}
                onCantidadTipo={(i, c) =>
                  setTipos((prev) => prev.map((t, j) => (j === i ? { ...t, cantidadPorPiso: c } : t)))
                }
                espacioOps={{ setContador, toggleEspacioSingular, renombrarEspacio, setMetraje, contar }}
                mostrarMetraje={modoMetraje === "espacio"}
                setEspaciosDeTipo={setEspaciosDeTipo}
              />
            ) : (
              <CasaBuilder
                esApto={esApto}
                pisos={pisos}
                onNumPisos={cambiarNumPisos}
                onCopiar={copiarPisoAnterior}
                espacioOps={{ setContador, toggleEspacioSingular, renombrarEspacio, setMetraje, contar }}
                mostrarMetraje={modoMetraje === "espacio"}
                setEspaciosDePiso={setEspaciosDePiso}
              />
            )}
          </div>
        )}

        {/* ── Paso 4: ¿Cuándo y dónde? ──────────────────────────────────── */}
        {paso === 3 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-slate-500">
              Indica las fechas estimadas y la ubicación. Todo es opcional y lo puedes cambiar después.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CampoFecha label="¿Cuándo inicia?" value={fechaInicio} onChange={setFechaInicio} />
              <CampoFecha label="¿Cuándo estimas que termina?" value={fechaFin} onChange={setFechaFin} min={fechaInicio} />
            </div>
            {plazoDias !== null && (
              <p className="text-xs text-blue-600 -mt-2">≈ {plazoDias} días hábiles de plazo.</p>
            )}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">¿Dónde se ubica la obra?</p>
              <LocationPicker value={ubicacion} onChange={setUbicacion} />
            </div>
          </div>
        )}

        {/* ── Paso 5: ¿Qué te falta? ────────────────────────────────────── */}
        {paso === 4 && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-slate-500">
              Marca lo que <strong className="text-slate-700">te falta por hacer</strong>. Desactiva lo que ya está
              terminado. Solo lo que dejes activo se hace seguimiento y requiere foto.
            </p>
            {/* Guía de primera vez (dismissible). Aparece solo si nunca se ha visto. */}
            {ayudaQFalta && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Info className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0 text-sm text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-800">¿Cómo configurar cada espacio?</p>
                  <p className="mt-0.5">
                    Para cada espacio te proponemos las tareas usuales. Deja activas las que
                    faltan por hacer, desactiva las que ya están listas y, si hace falta, agrega
                    las tuyas. Los días son una sugerencia: ajústalos a tu ritmo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={descartarAyudaQFalta}
                  aria-label="Entendido, cerrar ayuda"
                  className="text-slate-400 hover:text-slate-600 p-1 flex-shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* Señal de fuente: si la IA no corrió, lo decimos (ayuda a diagnosticar). */}
            {!iaCargando && iaFuente && iaFuente !== "ia" && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                <span>
                  Mostrando sugerencias base. Las sugerencias inteligentes no están disponibles por ahora
                  {iaFuente === "sin_key" ? " (falta configurar la conexión)" : ""}.
                </span>
              </div>
            )}
            {iaCargando ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col items-center text-center gap-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <p className="text-sm font-medium text-slate-700">Generando sugerencias para tus espacios…</p>
                <p className="text-xs text-slate-400">Analizamos cada espacio para proponerte solo las tareas que aplican.</p>
              </div>
            ) : (
              grupos.map((g, gi) => (
                <div key={gi} className="flex flex-col gap-3">
                  {g.titulo && <GrupoTitulo titulo={g.titulo} />}
                  {g.espacios.map((esp) => (
                    <EspacioTareas
                      key={esp.id}
                      espacio={esp}
                      primeraVez={ayudaQFalta}
                      onToggle={(idx) => toggleTarea(esp.id, idx)}
                      onDias={(idx, d) => cambiarDiasTarea(esp.id, idx, d)}
                      onAgregar={(n) => agregarTareaManual(esp.id, n)}
                      onEliminar={(idx) => eliminarTarea(esp.id, idx)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Paso 6: Costos ────────────────────────────────────────────── */}
        {paso === 5 && (
          <div className="flex flex-col gap-5">
            {/* Totales arriba (sensación de control) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sticky top-0 z-10">
              <label className="text-sm font-medium text-slate-700">Presupuesto total de la obra (opcional)</label>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  inputMode="numeric"
                  value={presupuestoTotal === "" ? "" : presupuestoTotal.toLocaleString("es-CO")}
                  onChange={(e) => onCambiarTotal(e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                <span>
                  Repartido en espacios: <strong className="text-slate-800">{fmtCOP(sumaCostosEspacios)}</strong>
                </span>
                <span>
                  {totalTareasActivas} tareas · {totalDias} días
                </span>
              </div>
            </div>
            {/* Sugerir presupuesto: IA anclada en precios de referencia (con respaldo) */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={sugerirPresupuesto}
                disabled={presupuestoCargando}
                className="inline-flex items-center justify-center gap-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 text-blue-700 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm cursor-pointer disabled:cursor-wait"
              >
                {presupuestoCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {presupuestoCargando ? "Calculando presupuesto…" : "Sugerir presupuesto"}
              </button>
              <p className="text-xs text-slate-400">
                ¿No sabes cuánto presupuestar? Estimamos el costo (mano de obra + materiales) con precios de
                referencia de Colombia. Es un punto de partida: ajusta lo que quieras.
              </p>
              {estimNota && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-slate-600 leading-relaxed">
                  Estimado: <strong className="text-slate-900">{fmtCOP(estimNota.total)}</strong>{" "}
                  <span className="text-slate-400">
                    (rango {fmtCOP(estimNota.min)} – {fmtCOP(estimNota.max)})
                  </span>
                  {estimNota.fuente === "base" && (
                    <>
                      {" · "}
                      <span className="text-amber-600">
                        estimado base (mano de obra). Conéctate para un estimado con materiales más preciso.
                      </span>
                    </>
                  )}
                  {estimNota.fuente === "ia" && (
                    <span className="text-slate-400"> · incluye materiales. Ajusta lo que no corresponda.</span>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Repartimos el monto por igual entre los espacios y, dentro de cada uno, según los días de cada tarea.
              Ajusta lo que quieras; los totales se recalculan automáticamente.
            </p>

            {grupos.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-3">
                {g.titulo && <GrupoTitulo titulo={g.titulo} />}
                {g.espacios
                  .filter((e) => e.tareas.some((t) => t.on))
                  .map((esp) => (
                    <EspacioCosto
                      key={esp.id}
                      espacio={esp}
                      onCosto={(c) => setCostoEspacio(esp.id, c)}
                      onToggle={() => toggleExpandido(esp.id)}
                      onPrecioTarea={(idx, p) => cambiarPrecioTarea(esp.id, idx, p)}
                      onDiasTarea={(idx, d) => cambiarDiasTarea(esp.id, idx, d)}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Pantalla final: Listo ─────────────────────────────────────── */}
        {paso === 6 && (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {esEdicion ? "¡Cambios guardados!" : "¡Tu obra está lista!"}
            </h2>
            <p className="text-sm text-slate-600 max-w-sm leading-relaxed">
              De ahora en adelante, <strong className="text-slate-900">nadie marca una tarea como hecha sin una foto
              que tú apruebes</strong>. Y cada peso de material queda con su factura.
            </p>
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm mt-2">
              <dl className="divide-y divide-slate-100">
                <ResumenFila k="Obra" v={nombreObra} />
                <ResumenFila k="Tipo" v={TIPOS_PROPIEDAD.find((p) => p.key === tipoPropiedad)?.label ?? ""} />
                <ResumenFila k="Espacios" v={`${todosEspacios.filter((e) => e.tareas.some((t) => t.on)).length}`} />
                <ResumenFila k="Tareas pendientes" v={`${totalTareasActivas}`} />
                {typeof presupuestoTotal === "number" && presupuestoTotal > 0 && (
                  <ResumenFila k="Presupuesto" v={fmtCOP(presupuestoTotal)} />
                )}
              </dl>
            </div>
          </div>
        )}

        {/* ── Botones ───────────────────────────────────────────────────── */}
        <div className="flex gap-3 mt-8">
          {paso > 0 && paso <= TOTAL_PASOS && (
            <button
              type="button"
              onClick={retroceder}
              disabled={enviando}
              className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          {/* En edición: guardar desde cualquier paso, sin recorrer todo el wizard. */}
          {esEdicion && paso < TOTAL_PASOS - 1 && (
            <button
              type="button"
              onClick={crear}
              disabled={enviando}
              className="inline-flex items-center justify-center gap-2 border border-blue-600 bg-white text-blue-700 hover:bg-blue-50 font-semibold py-3 px-5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {enviando ? "Guardando…" : "Guardar cambios"}
            </button>
          )}
          {paso < TOTAL_PASOS - 1 ? (
            <button
              type="button"
              onClick={avanzar}
              disabled={!puedeAvanzar}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          ) : paso === TOTAL_PASOS - 1 ? (
            <button
              type="button"
              onClick={crear}
              disabled={enviando}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-sm cursor-pointer"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {enviando
                ? esEdicion
                  ? "Guardando cambios…"
                  : "Creando tu obra…"
                : esEdicion
                  ? "Guardar cambios"
                  : "Crear mi obra"}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// ─── Helpers fuera del componente ──────────────────────────────────────────────

function ordinalPiso(n: number): string {
  const ord = ["Primer", "Segundo", "Tercer", "Cuarto", "Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"];
  return `— ${ord[n - 1] ?? `Piso ${n}`} piso`;
}

function ciudadDesde(direccion?: string): string | undefined {
  if (!direccion) return undefined;
  // Mejor esfuerzo: toma el penúltimo segmento de "Calle X, Ciudad, País".
  const partes = direccion.split(",").map((p) => p.trim()).filter(Boolean);
  if (partes.length >= 2) return partes[partes.length - 2].slice(0, 120);
  return undefined;
}

// ─── Subcomponentes de estructura ──────────────────────────────────────────────

interface EspacioOps {
  setContador: (e: EspacioW[], baseLabel: string, n: number) => EspacioW[];
  toggleEspacioSingular: (e: EspacioW[], label: string) => EspacioW[];
  renombrarEspacio: (e: EspacioW[], id: string, nombre: string) => EspacioW[];
  setMetraje: (e: EspacioW[], id: string, m?: number) => EspacioW[];
  contar: (e: EspacioW[], baseLabel: string) => number;
}

/**
 * Selector del área de la obra. Dos modos:
 *  - "total"   → un único campo de m² de toda la obra.
 *  - "espacio" → metraje campo a campo en cada espacio (los inputs aparecen en
 *                la lista de espacios; aquí solo se explica).
 * El metraje es opcional en ambos casos: solo afina el estimado de presupuesto.
 */
function AreaObra({
  modo,
  metrajeTotal,
  recomendadoPorEspacio,
  onModo,
  onMetrajeTotal,
}: {
  modo: "total" | "espacio";
  metrajeTotal: number | "";
  recomendadoPorEspacio: boolean;
  onModo: (m: "total" | "espacio") => void;
  onMetrajeTotal: (m: number | "") => void;
}) {
  const opciones: { key: "total" | "espacio"; label: string }[] = [
    { key: "total", label: "Área de toda la obra" },
    { key: "espacio", label: "Por espacio" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">¿Cómo nos das el área?</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Es opcional, pero nos ayuda a estimar mejor el presupuesto.
        </p>
      </div>
      <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 self-start">
        {opciones.map((o) => {
          const activo = modo === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onModo(o.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activo ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {o.label}
              {recomendadoPorEspacio === (o.key === "espacio") && (
                <span className="ml-1.5 text-[10px] font-semibold text-blue-500">sugerido</span>
              )}
            </button>
          );
        })}
      </div>
      {modo === "total" ? (
        <div>
          <label className="text-sm font-medium text-slate-700">Área total de la obra (m²)</label>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={metrajeTotal === "" ? "" : metrajeTotal}
              onChange={(e) =>
                onMetrajeTotal(e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0))
              }
              placeholder="Ej: 80"
              className="w-32 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
            <span className="text-sm text-slate-400">m²</span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Repartiremos esta área entre los espacios para estimar el presupuesto.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Más abajo, en cada espacio, encontrarás un campo de m² para precisar su área.
          Es ideal si conoces el detalle de cada ambiente.
        </p>
      )}
    </div>
  );
}

function CasaBuilder({
  esApto,
  pisos,
  onNumPisos,
  onCopiar,
  espacioOps,
  mostrarMetraje,
  setEspaciosDePiso,
}: {
  esApto: boolean;
  pisos: PisoW[];
  onNumPisos: (delta: number) => void;
  onCopiar: (idx: number) => void;
  espacioOps: EspacioOps;
  mostrarMetraje: boolean;
  setEspaciosDePiso: (idx: number, fn: (e: EspacioW[]) => EspacioW[]) => void;
}) {
  return (
    <>
      {!esApto && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">¿Cuántos pisos tiene?</p>
            <p className="text-xs text-slate-500">Configura cada piso por separado.</p>
          </div>
          <Stepper value={pisos.length} onChange={onNumPisos} min={1} max={10} />
        </div>
      )}

      {pisos.map((piso, idx) => (
        <PisoCard
          key={idx}
          idx={idx}
          titulo={pisos.length > 1 ? ordinalPiso(idx + 1).replace("— ", "") : esApto ? "Tu apartamento" : "Tu casa"}
          espacios={piso.espacios}
          puedeCopiar={idx > 0}
          onCopiar={() => onCopiar(idx)}
          espacioOps={espacioOps}
          mostrarMetraje={mostrarMetraje}
          setEspacios={(fn) => setEspaciosDePiso(idx, fn)}
        />
      ))}
    </>
  );
}

function EdificioBuilder({
  numPisos,
  aptosPorPiso,
  usaDireccion,
  tipos,
  onNumPisos,
  onAptosPorPiso,
  onUsaDireccion,
  onAgregarTipo,
  onQuitarTipo,
  onRenombrarTipo,
  onCantidadTipo,
  espacioOps,
  mostrarMetraje,
  setEspaciosDeTipo,
}: {
  numPisos: number;
  aptosPorPiso: number;
  usaDireccion: boolean;
  tipos: TipoAptoW[];
  onNumPisos: (n: number) => void;
  onAptosPorPiso: (n: number) => void;
  onUsaDireccion: (v: boolean) => void;
  onAgregarTipo: () => void;
  onQuitarTipo: (i: number) => void;
  onRenombrarTipo: (i: number, n: string) => void;
  onCantidadTipo: (i: number, c?: number) => void;
  espacioOps: EspacioOps;
  mostrarMetraje: boolean;
  setEspaciosDeTipo: (idx: number, fn: (e: EspacioW[]) => EspacioW[]) => void;
}) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">¿Cuántos pisos tiene el edificio?</p>
          <Stepper value={numPisos} onChange={(d) => onNumPisos(Math.max(1, Math.min(50, numPisos + d)))} min={1} max={50} />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-800">¿Cuántos apartamentos por piso?</p>
          <Stepper
            value={aptosPorPiso}
            onChange={(d) => onAptosPorPiso(Math.max(1, Math.min(20, aptosPorPiso + d)))}
            min={1}
            max={20}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={usaDireccion}
            onChange={(e) => onUsaDireccion(e.target.checked)}
            className="rounded accent-blue-600"
          />
          Usar nomenclatura por dirección (izquierda / derecha)
        </label>
      </div>

      <p className="text-sm font-medium text-slate-700 mt-1">Define los tipos de apartamento</p>
      <p className="text-xs text-slate-500 -mt-2">
        No defines apto por apto: describes los <strong>tipos</strong> y nosotros los repetimos en cada piso.
      </p>

      {tipos.map((tipo, idx) => (
        <div key={idx} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
            <input
              value={tipo.nombre}
              onChange={(e) => onRenombrarTipo(idx, e.target.value)}
              className="font-semibold text-slate-800 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-400 focus:outline-none flex-1"
            />
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <input
                type="number"
                min={0}
                value={tipo.cantidadPorPiso ?? ""}
                onChange={(e) => onCantidadTipo(idx, e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value)))}
                placeholder="auto"
                className="w-14 text-center border border-slate-200 rounded-md py-1"
                title="Cuántos de este tipo hay por piso (opcional)"
              />
              /piso
            </div>
            {tipos.length > 1 && (
              <button type="button" onClick={() => onQuitarTipo(idx)} className="text-slate-400 hover:text-red-500 p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="p-4">
            <EspaciosEditor
              espacios={tipo.espacios}
              espacioOps={espacioOps}
              mostrarMetraje={mostrarMetraje}
              setEspacios={(fn) => setEspaciosDeTipo(idx, fn)}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAgregarTipo}
        className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 text-sm font-medium"
      >
        <Plus className="w-4 h-4" /> Agregar otro tipo de apartamento
      </button>
    </>
  );
}

function PisoCard({
  titulo,
  espacios,
  puedeCopiar,
  onCopiar,
  espacioOps,
  mostrarMetraje,
  setEspacios,
}: {
  idx: number;
  titulo: string;
  espacios: EspacioW[];
  puedeCopiar: boolean;
  onCopiar: () => void;
  espacioOps: EspacioOps;
  mostrarMetraje: boolean;
  setEspacios: (fn: (e: EspacioW[]) => EspacioW[]) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <span className="font-semibold text-slate-800 text-sm">{titulo}</span>
        {puedeCopiar && (
          <button
            type="button"
            onClick={onCopiar}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar del piso anterior
          </button>
        )}
      </div>
      <div className="p-4">
        <EspaciosEditor
          espacios={espacios}
          espacioOps={espacioOps}
          mostrarMetraje={mostrarMetraje}
          setEspacios={setEspacios}
        />
      </div>
    </div>
  );
}

/** Editor común de espacios: steppers de habitaciones/baños + toggles singulares + lista renombrable. */
function EspaciosEditor({
  espacios,
  espacioOps,
  mostrarMetraje,
  setEspacios,
}: {
  espacios: EspacioW[];
  espacioOps: EspacioOps;
  mostrarMetraje: boolean;
  setEspacios: (fn: (e: EspacioW[]) => EspacioW[]) => void;
}) {
  const nHab = espacioOps.contar(espacios, "Habitación");
  const nBano = espacioOps.contar(espacios, "Baño");
  const [otro, setOtro] = useState("");

  function agregarOtro() {
    const v = otro.trim();
    if (!v) return;
    setEspacios((prev) => espacioOps.toggleEspacioSingular(prev, v));
    setOtro("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Steppers de habitaciones y baños */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
          <span className="text-sm text-slate-700">Habitaciones</span>
          <Stepper
            value={nHab}
            min={0}
            max={20}
            onChange={(d) => setEspacios((e) => espacioOps.setContador(e, "Habitación", nHab + d))}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
          <span className="text-sm text-slate-700">Baños</span>
          <Stepper
            value={nBano}
            min={0}
            max={20}
            onChange={(d) => setEspacios((e) => espacioOps.setContador(e, "Baño", nBano + d))}
          />
        </div>
      </div>

      {/* Toggles de espacios singulares */}
      <div className="flex flex-wrap gap-2">
        {ESPACIOS_TOGGLE.map((e) => {
          const activo = espacios.some((x) => x.nombre === e.label);
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => setEspacios((prev) => espacioOps.toggleEspacioSingular(prev, e.label))}
              className={`inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full border text-sm font-medium transition-colors cursor-pointer ${
                activo ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${activo ? "bg-white/20" : "bg-blue-50 text-blue-600"}`}>
                <EspacioGlyph nombre={e.key} size={14} />
              </span>
              {e.label}
              {activo && <Check className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>

      {/* Otro espacio (texto libre) */}
      <div className="flex gap-2">
        <input
          value={otro}
          onChange={(e) => setOtro(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregarOtro();
            }
          }}
          placeholder="Otro espacio (ej: Sótano, Patio)"
          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
        <button
          type="button"
          onClick={agregarOtro}
          className="inline-flex items-center gap-1 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {/* Lista de espacios generados (renombrables + m²) */}
      {espacios.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
          {espacios.map((esp) => (
            <EspacioRow
              key={esp.id}
              espacio={esp}
              mostrarMetraje={mostrarMetraje}
              onRename={(n) => setEspacios((e) => espacioOps.renombrarEspacio(e, esp.id, n))}
              onMetraje={(m) => setEspacios((e) => espacioOps.setMetraje(e, esp.id, m))}
              onRemove={() => setEspacios((e) => e.filter((x) => x.id !== esp.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EspacioRow({
  espacio,
  mostrarMetraje,
  onRename,
  onMetraje,
  onRemove,
}: {
  espacio: EspacioW;
  mostrarMetraje: boolean;
  onRename: (n: string) => void;
  onMetraje: (m?: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
        <EspacioGlyph nombre={espacio.nombre} size={16} />
      </span>
      <div className="relative flex-1">
        <input
          value={espacio.nombre}
          onChange={(e) => onRename(e.target.value)}
          className="w-full text-sm text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none py-1 pr-5"
        />
        <Pencil className="w-3 h-3 text-slate-300 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {mostrarMetraje && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            min={0}
            value={espacio.metraje ?? ""}
            onChange={(e) => onMetraje(e.target.value === "" ? undefined : Math.max(0, parseFloat(e.target.value)))}
            placeholder="m²"
            className="w-14 text-center text-xs border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}
      <button type="button" onClick={onRemove} className="text-slate-300 hover:text-red-500 p-1 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Subcomponentes de tareas / costos ─────────────────────────────────────────

function EspacioTareas({
  espacio,
  primeraVez,
  onToggle,
  onDias,
  onAgregar,
  onEliminar,
}: {
  espacio: EspacioW;
  primeraVez: boolean;
  onToggle: (idx: number) => void;
  onDias: (idx: number, d: number) => void;
  onAgregar: (nombre: string) => void;
  onEliminar: (idx: number) => void;
}) {
  const [nueva, setNueva] = useState("");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 font-semibold text-slate-800 text-sm flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <EspacioGlyph nombre={espacio.nombre} size={15} />
        </span>
        {espacio.nombre}
      </div>
      {/* Mensaje contextual de primera vez para este espacio (no intrusivo). */}
      {primeraVez && (
        <p className="px-4 pt-2.5 -mb-1 text-[11px] text-slate-400 leading-relaxed">
          Deja activo lo que falta por hacer en {espacio.nombre.toLowerCase()} y ajusta los días.
        </p>
      )}
      {/* Encabezados de columna */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="w-5 flex-shrink-0" aria-hidden />
        <span className="flex-1">Tareas sugeridas</span>
        <span className="flex items-center gap-1 flex-shrink-0">
          <span
            className="inline-flex items-center gap-1 cursor-help group relative"
            title="Son los días que debería tardar cada tarea según lo usual. Ajústalos a tu caso."
          >
            Días sugeridos
            <Info className="w-3 h-3 text-slate-300" />
            {/* Tooltip en hover (touch usa el atributo title). */}
            <span className="pointer-events-none absolute right-0 top-full mt-1.5 z-20 hidden group-hover:block w-52 rounded-lg bg-slate-800 text-white text-[11px] font-normal normal-case tracking-normal leading-snug px-3 py-2 shadow-lg">
              Son los días que debería tardar cada tarea según lo usual. Ajústalos a tu caso.
            </span>
          </span>
        </span>
      </div>
      <div className="p-2 flex flex-col">
        {espacio.tareas.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50">
            <button
              type="button"
              onClick={() => onToggle(idx)}
              className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                t.on ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
              }`}
            >
              {t.on && <Check className="w-3.5 h-3.5" />}
            </button>
            <span className={`flex-1 text-sm ${t.on ? "text-slate-800" : "text-slate-400 line-through"}`}>{t.nombre}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="number"
                min={1}
                value={t.dias}
                onChange={(e) => onDias(idx, parseInt(e.target.value))}
                className="w-12 text-center text-xs border border-slate-200 rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-[11px] text-slate-400">días</span>
            </div>
            <button
              type="button"
              onClick={() => onEliminar(idx)}
              aria-label={`Eliminar ${t.nombre}`}
              title="Eliminar esta tarea (no aplica)"
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 px-2 py-2">
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAgregar(nueva);
                setNueva("");
              }
            }}
            placeholder="Agregar otra tarea…"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          <button
            type="button"
            onClick={() => {
              onAgregar(nueva);
              setNueva("");
            }}
            className="inline-flex items-center px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EspacioCosto({
  espacio,
  onCosto,
  onToggle,
  onPrecioTarea,
  onDiasTarea,
}: {
  espacio: EspacioW;
  onCosto: (c?: number) => void;
  onToggle: () => void;
  onPrecioTarea: (idx: number, p?: number) => void;
  onDiasTarea: (idx: number, d: number) => void;
}) {
  const activas = espacio.tareas.map((t, i) => ({ t, i })).filter((x) => x.t.on);
  const dias = activas.reduce((a, x) => a + x.t.dias, 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          <EspacioGlyph nombre={espacio.nombre} size={18} strokeWidth={1.5} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{espacio.nombre}</p>
          <p className="text-[11px] text-slate-400">{activas.length} tareas · {dias} días</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-slate-400 text-sm">$</span>
          <input
            inputMode="numeric"
            value={espacio.costo ? espacio.costo.toLocaleString("es-CO") : ""}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              onCosto(v === "" ? undefined : parseInt(v));
            }}
            placeholder="0"
            className="w-28 px-2.5 py-2 rounded-xl border border-slate-200 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2 border-t border-slate-100 text-xs text-blue-600 hover:bg-blue-50/40 flex items-center justify-center gap-1 font-medium"
      >
        {espacio.expandido ? "Ocultar" : "Detallar por tarea"}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${espacio.expandido ? "rotate-180" : ""}`} />
      </button>
      {espacio.expandido && (
        <div className="px-4 pb-3 pt-1 flex flex-col gap-2 bg-slate-50/40">
          {/* Encabezados de columna */}
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="flex-1">Tarea</span>
            <span className="w-16 text-center">Días</span>
            <span className="w-28 text-right">Precio (COP)</span>
          </div>
          {activas.map(({ t, i }) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-slate-700 truncate">{t.nombre}</span>
              <input
                type="number"
                min={1}
                value={t.dias}
                onChange={(e) => onDiasTarea(i, parseInt(e.target.value))}
                className="w-16 text-center text-sm border border-slate-200 rounded-md py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="relative w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                <input
                  inputMode="numeric"
                  value={t.precio ? t.precio.toLocaleString("es-CO") : ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    onPrecioTarea(i, v === "" ? undefined : parseInt(v));
                  }}
                  placeholder="auto"
                  className="w-full pl-5 pr-2 py-1.5 rounded-md border border-slate-200 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 pt-0.5">
            Deja el precio en <strong>auto</strong> para repartir el costo del espacio entre sus tareas según los días.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Átomos UI ──────────────────────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (delta: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(-1)}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-6 text-center font-semibold text-slate-800 text-sm">{value}</span>
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-30 hover:bg-slate-50 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function BigCard({
  Icon,
  titulo,
  desc,
  activo,
  onClick,
}: {
  Icon: LucideIcon;
  titulo: string;
  desc: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 text-left p-4 rounded-2xl border transition-all cursor-pointer ${
        activo ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      <IconBox Icon={Icon} size="md" active={activo} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 text-sm">{titulo}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activo ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
        {activo && <Check className="w-3 h-3 text-white" />}
      </div>
    </button>
  );
}

function ChipPropiedad({
  Icon,
  label,
  activo,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border transition-all cursor-pointer ${
        activo ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20" : "border-slate-200 bg-white hover:border-blue-300"
      }`}
    >
      <IconBox Icon={Icon} size="lg" active={activo} />
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </button>
  );
}

function GrupoTitulo({ titulo }: { titulo: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{titulo}</p>;
}

function Campo({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
      />
    </div>
  );
}

function CampoFecha({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="date"
        value={value}
        min={min || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-900"
      />
    </div>
  );
}

function ResumenFila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-slate-500 flex-shrink-0">{k}</dt>
      <dd className="text-slate-800 font-medium text-right">{v}</dd>
    </div>
  );
}
