"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, Eye, EyeOff, Loader2, X } from "lucide-react";
import type { Contratista, TipoUnidadInput, EdificioInput, TareaInput, EditModeData, PersonaProyectoInput, AsignacionOverride, UbicacionInput, VentanaPlan } from "./wizard-types";
import type { TaskTemplate } from "@/lib/task-templates";
import { excesosMetraje } from "@/lib/metraje";
import {
  BORRADOR_VERSION,
  borrarBorrador,
  claveBorrador,
  edadLegible,
  guardarBorrador,
  leerBorrador,
  type BorradorWizard,
  type DatosBorrador,
} from "./borrador";
import { faltantesFechasObra } from "./wizard-types";
import {
  fechaISO,
  repartirCronograma,
  type FaseReparto,
  type ModoCronograma,
  type TareaReparto,
} from "@/lib/reparto-cronograma";
import WizardStep1 from "./WizardStep1";
import WizardStep2 from "./WizardStep2";
import WizardStep3 from "./WizardStep3";

// `muestraEconomia` decide si el asistente ENSEÑA el dinero de la obra (precios
// por tarea). Se recibe como prop desde el server component que conoce el tipo
// de cuenta -nunca se lee de contexto ni de cookies- para que se vea de un
// vistazo quien toma la decision. Se oculta en B2B y sigue vivo en B2C.
//
// Es opcional por una razon concreta: este wizard lo montan dos paginas
// (`nuevo/page.tsx` y `[id]/editar/page.tsx`) y ambas mandan a las cuentas
// personales a otro flujo antes de llegar aqui, asi que el asistente de empresa
// es B2B puro. Por eso el defecto es `false`: apagar es lo correcto donde no
// llega B2C, y un defecto `true` dejaria los precios encendidos en la pagina
// que todavia no pasa la prop.
export default function WizardClient({
  contratistas,
  contratistasHabituales,
  initialData,
  tareasAprendidas,
  muestraEconomia,
  usuarioId,
}: {
  contratistas: Contratista[];
  /**
   * Ids de contratistas con tareas en los ultimos proyectos de la
   * constructora. Solo preseleccionan el multi-select del paso 1 en modo
   * alta; la pagina de edicion no la pasa (una obra ya creada tiene su
   * propia historia y no se le inventa un equipo).
   */
  contratistasHabituales?: string[];
  initialData?: EditModeData;
  tareasAprendidas?: Record<string, Record<string, TaskTemplate[]>>;
  /**
   * Si el asistente ensena el dinero de la obra. SIN DEFECTO a proposito: un
   * defecto convierte "se me olvido pasarla" en un numero plausible y nadie lo
   * nota. Sin el, cualquier pantalla nueva que monte el asistente no compila
   * hasta decidir que hace con el dinero.
   */
  muestraEconomia: boolean;
  /**
   * Id del usuario que abre el asistente. Solo se usa para la clave del
   * borrador local: los PC de oficina se comparten y el borrador de un
   * admin no puede aparecerle a otro. Sin id no hay autoguardado.
   */
  usuarioId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Edit mode password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingTareas, setPendingTareas] = useState<TareaInput[] | undefined>(undefined);

  const isEditMode = !!initialData;

  // Step 1 state
  const [nombre, setNombre] = useState(initialData?.nombre ?? "");
  const [numeroRegistro, setNumeroRegistro] = useState(initialData?.numeroRegistro ?? "");

  // ── Contratistas del proyecto (paso 1) ────────────────────────────────────
  // Vive SOLO en el estado del asistente: siembra el pool del paso 3 y muere
  // ahi — no viaja al API ni crea asignaciones. Preseleccionar NO es asignar:
  // la asignacion sigue siendo un acto explicito del admin en el paso 3.
  // En alta arranca con los habituales; en edicion arranca vacio a proposito.
  const habitualesIniciales = isEditMode ? [] : (contratistasHabituales ?? []);
  const [contratistasProyecto, setContratistasProyecto] = useState<string[]>(habitualesIniciales);

  // El contratista por defecto NO se autocompleta desde los habituales, y es
  // deliberado: ese campo es el fallback de `asignado_a` de TODAS las tareas
  // sin asignar — quien caiga ahi queda como responsable de la obra entera.
  // La regla del multi-select es «preseleccionar no asigna»; autocompletar el
  // default la violaria por la puerta de atras. Elegirlo es un acto del admin.
  const [contratistaDefaultId, setContratistaDefaultId] = useState(initialData?.contratistaDefaultId ?? "");

  function toggleContratistaProyecto(id: string) {
    setContratistasProyecto((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  const [clienteId, setClienteId] = useState(initialData?.clienteId ?? "");
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.ok ? r.json() : []).then(setClientes);
  }, []);
  const [subtipo, setSubtipo] = useState<"APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES">(initialData?.subtipo ?? "APARTAMENTOS");
  const [diasHabiles, setDiasHabiles] = useState(initialData?.diasHabiles ?? 5);
  const [fechaInicio, setFechaInicio] = useState(initialData?.fechaInicio ?? "");
  const [fechaFin, setFechaFin] = useState(initialData?.fechaFin ?? "");
  const [ubicacion, setUbicacion] = useState<UbicacionInput | null>(initialData?.ubicacion ?? null);
  const [tiposUnidad, setTiposUnidad] = useState<TipoUnidadInput[]>(initialData?.tiposUnidad ?? [
    { id: "t1", nombre: "Tipo estándar", espacios: ["Cocina", "Baño principal", "Habitación principal", "Sala-comedor"] },
  ]);
  const [edificios, setEdificios] = useState<EdificioInput[]>(initialData?.edificios ?? [
    { nombre: "Torre 1", pisos: 5, unidades_por_piso: 4, distribucion: { "t1": { derecha: 10, izquierda: 10 } } },
  ]);
  const [tieneZonasComunes, setTieneZonasComunes] = useState(initialData?.tieneZonasComunes ?? false);
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>(initialData?.zonasSeleccionadas ?? []);
  const [metrosEnabled, setMetrosEnabled] = useState(initialData?.metrosEnabled ?? false);
  const [metrosZonas, setMetrosZonas] = useState<Record<string, number>>(initialData?.metrosZonas ?? {});

  // Step 2 state
  const allEspacios = [...new Set(tiposUnidad.flatMap((t) => t.espacios))];
  const [fasesSeleccionadas, setFasesSeleccionadas] = useState<string[]>(initialData?.fasesSeleccionadas ?? ["Madera", "Obra Blanca"]);
  const [tareas, setTareas] = useState<TareaInput[]>(initialData?.tareas ?? []);
  const [faseDias, setFaseDias] = useState<Record<string, number | undefined>>(initialData?.faseDias ?? {});

  // ── Cronograma planeado ───────────────────────────────────────────────────
  // El modo decide QUIEN pone cada fecha, no como se calculan. FASES viene
  // preseleccionado porque es el punto donde el cliente sabe algo real -sabe
  // cuando quiere tener la estructura arriba- sin obligarle a fechar tarea por
  // tarea. AUTOMATICO pide menos y MANUAL pide todo.
  const [modoCronograma, setModoCronograma] = useState<ModoCronograma>(initialData?.modoCronograma ?? "FASES");
  const [faseVentanas, setFaseVentanas] = useState<Record<string, VentanaPlan>>(initialData?.faseVentanas ?? {});
  const [tareaVentanas, setTareaVentanas] = useState<Record<string, VentanaPlan>>(initialData?.tareaVentanas ?? {});

  // ¿Esta obra tenia cronograma ANTES de abrir el asistente?
  //
  // Es la diferencia entre «el usuario eligio un modo» y «esta obra nunca tuvo
  // plan». Sin distinguirlo, editar una obra vieja para cambiarle el nombre le
  // escribia diez ventanas de fase inventadas, y el informe pasaba a publicar
  // un SPI calculado contra un plan que nadie aprobo.
  const teniaCronograma = initialData?.modoCronograma != null;
  // Se elige un modo A PROPOSITO cuando el usuario lo toca en el paso 2.
  const [modoElegido, setModoElegido] = useState(teniaCronograma);

  // Step 3 state
  const [personas, setPersonas] = useState<PersonaProyectoInput[]>([]);
  // En modo edición precargamos las asignaciones reverse-engineered desde la BD
  // para que el accordion muestre el estado real y el usuario pueda editar.
  const [asignaciones, setAsignaciones] = useState<AsignacionOverride[]>(initialData?.asignaciones ?? []);

  // ── Pool de contratistas por fase (paso 3) ────────────────────────────────
  // Vive aqui y no en WizardStep3 porque se siembra desde el paso 1
  // (`contratistasProyecto`) y un autoguardado posterior lo va a serializar.
  // El pool tampoco asigna nada: es el menu del que el builder del paso 3
  // saca gente, y sobrevive a ir y volver entre pasos.
  const [pool, setPool] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(fasesSeleccionadas.map((f) => [f, [] as string[]]))
  );
  // Fases cuyo pool el admin VACIO a mano. La siembra solo rellena pools
  // vacios, pero «vacio porque nunca se toco» y «vacio porque el admin saco
  // a todos» no son lo mismo: re-sembrar el segundo seria pisar su decision.
  const fasesVaciadasAMano = useRef<Set<string>>(new Set());

  function addToPool(fase: string, cId: string) {
    setPool((p) => ({ ...p, [fase]: p[fase]?.includes(cId) ? p[fase] : [...(p[fase] ?? []), cId] }));
  }

  function removeFromPool(fase: string, cId: string) {
    // Se calcula ANTES del setState, con el estado fresco del evento: dentro
    // del updater seria mutar un ref en una funcion que React puede repetir.
    if ((pool[fase] ?? []).filter((id) => id !== cId).length === 0) {
      fasesVaciadasAMano.current.add(fase);
    }
    setPool((p) => ({ ...p, [fase]: (p[fase] ?? []).filter((id) => id !== cId) }));
    // Sacar del pool retira tambien sus asignaciones de esa fase: dejar
    // overrides de alguien que ya no esta seria una asignacion invisible.
    setAsignaciones((p) => p.filter((o) => !(o.fase === fase && o.contratista_id === cId)));
  }

  /**
   * Siembra el pool del paso 3 con los contratistas del proyecto elegidos en
   * el paso 1. Solo rellena fases con pool vacio que el admin no vacio a
   * mano: la siembra es un punto de partida, nunca una correccion de lo que
   * el admin ya decidio. Y sembrar NO crea asignaciones.
   */
  function sembrarPool() {
    if (contratistasProyecto.length === 0) return;
    setPool((prev) => {
      let cambio = false;
      const next = { ...prev };
      for (const f of fasesSeleccionadas) {
        if ((next[f] ?? []).length === 0 && !fasesVaciadasAMano.current.has(f)) {
          next[f] = [...contratistasProyecto];
          cambio = true;
        }
      }
      return cambio ? next : prev;
    });
  }

  // ── Borrador local (autoguardado) ─────────────────────────────────────────
  // Ver el porqué completo en ./borrador.ts. Aquí solo vive el cableado:
  // detectar al montar, preguntar (nunca restaurar en silencio), guardar con
  // debounce y borrar al crear el proyecto. Solo en modo alta: en edición la
  // verdad vive en la base y un borrador local podría pisar datos más nuevos.
  const claveB = !isEditMode && usuarioId ? claveBorrador(usuarioId) : null;
  const [borradorGuardado, setBorradorGuardado] = useState<BorradorWizard | null>(null);
  const [decisionBorrador, setDecisionBorrador] = useState<"sin_borrador" | "pendiente" | "resuelta">("sin_borrador");

  useEffect(() => {
    // localStorage solo existe en el navegador: leer al montar, nunca en el
    // initializer de un useState (rompería la hidratación de React).
    if (!claveB) return;
    const b = leerBorrador(claveB);
    if (b) {
      setBorradorGuardado(b);
      setDecisionBorrador("pendiente");
    }
    // La clave no cambia en la vida del componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function snapshotDatos(): DatosBorrador {
    return {
      nombre, numeroRegistro, contratistaDefaultId, contratistasProyecto,
      clienteId, subtipo, diasHabiles, fechaInicio, fechaFin, ubicacion,
      tiposUnidad, edificios, tieneZonasComunes, zonasSeleccionadas,
      metrosEnabled, metrosZonas, fasesSeleccionadas, tareas, faseDias,
      modoCronograma, modoElegido, faseVentanas, tareaVentanas, personas,
      asignaciones, pool,
      fasesVaciadasAMano: [...fasesVaciadasAMano.current],
    };
  }

  function retomarBorrador() {
    if (!borradorGuardado) return;
    const d = borradorGuardado.datos;
    setNombre(d.nombre); setNumeroRegistro(d.numeroRegistro);
    setClienteId(d.clienteId); setSubtipo(d.subtipo);
    setDiasHabiles(d.diasHabiles); setFechaInicio(d.fechaInicio); setFechaFin(d.fechaFin);
    setUbicacion(d.ubicacion); setTiposUnidad(d.tiposUnidad); setEdificios(d.edificios);
    setTieneZonasComunes(d.tieneZonasComunes); setZonasSeleccionadas(d.zonasSeleccionadas);
    setMetrosEnabled(d.metrosEnabled); setMetrosZonas(d.metrosZonas);
    setFasesSeleccionadas(d.fasesSeleccionadas); setTareas(d.tareas); setFaseDias(d.faseDias);
    setModoCronograma(d.modoCronograma); setModoElegido(d.modoElegido);
    setFaseVentanas(d.faseVentanas); setTareaVentanas(d.tareaVentanas);
    setPersonas(d.personas);
    // Un borrador puede traer ids de contratistas que ya no existen (los
    // borraron o perdieron el rol entre visitas). Se sanean aqui y no en el
    // submit: mandarlos al servidor daria un 400 criptico, y dejarlos en el
    // pool hace que una fase «parezca» tener equipo cuando no tiene a nadie.
    const idsValidos = new Set(contratistas.map((c) => c.id));
    setContratistaDefaultId(idsValidos.has(d.contratistaDefaultId) ? d.contratistaDefaultId : "");
    setContratistasProyecto(d.contratistasProyecto.filter((id) => idsValidos.has(id)));
    setAsignaciones(d.asignaciones.filter((a) => idsValidos.has(a.contratista_id)));
    setPool(Object.fromEntries(
      Object.entries(d.pool).map(([f, ids]) => [f, ids.filter((id) => idsValidos.has(id))])
    ));
    fasesVaciadasAMano.current = new Set(d.fasesVaciadasAMano ?? []);
    setStep(borradorGuardado.step);
    setDecisionBorrador("resuelta");
  }

  function descartarBorrador() {
    if (claveB) borrarBorrador(claveB);
    setBorradorGuardado(null);
    setDecisionBorrador("resuelta");
  }

  // Guardado con debounce. Sin array de dependencias A PROPÓSITO: cada render
  // reprograma el timeout, así que se guarda 1.2 s después del ÚLTIMO cambio.
  // Listar aquí las ~26 piezas de estado sería el clásico bug latente: la
  // primera que alguien olvide al agregar un campo deja de autoguardarse en
  // silencio. Un setTimeout/clearTimeout por render es despreciable.
  // Compuertas: (1) hay clave (alta con usuario); (2) el aviso de borrador no
  // está esperando decisión — guardar ahí pisaría el borrador ANTES de que el
  // usuario elija; (3) hay contenido real — abrir la página y salir no debe
  // fabricar borradores fantasma; (4) no hay un submit en vuelo — si el
  // proyecto se crea en menos que el debounce, el timer pendiente escribiría
  // el borrador DESPUÉS de que el éxito lo borró, y la próxima visita
  // ofrecería «retomar» una obra ya creada. El render de loading=true cancela
  // ese timer vía cleanup y esta compuerta impide programar otro.
  const hayContenidoBorrador =
    nombre.trim() !== "" || tareas.length > 0 || zonasSeleccionadas.length > 0 || personas.length > 0;
  useEffect(() => {
    if (!claveB || loading || decisionBorrador === "pendiente" || !hayContenidoBorrador) return;
    const t = setTimeout(() => {
      guardarBorrador(claveB, {
        version: BORRADOR_VERSION,
        guardadoEn: new Date().toISOString(),
        step,
        datos: snapshotDatos(),
      });
    }, 1200);
    return () => clearTimeout(t);
  });

  // Computed
  const totalUnidades = subtipo === "ZONAS_COMUNES" ? 0 : edificios.reduce((acc, e) => {
    const perFloor = e.unidades_por_piso ?? 0;
    return acc + e.pisos * perFloor;
  }, 0);
  // Units per tipo_unidad_id, summed across all edificios' distribución.
  const unidadesPorTipo: Record<string, number> = subtipo === "ZONAS_COMUNES" ? {} : edificios.reduce<Record<string, number>>((acc, e) => {
    for (const [tipoId, dist] of Object.entries(e.distribucion)) {
      acc[tipoId] = (acc[tipoId] ?? 0) + (dist.derecha ?? 0) + (dist.izquierda ?? 0);
    }
    return acc;
  }, {});
  // Tareas de fases que YA NO estan seleccionadas: se CONSERVAN en el estado
  // (quitar una fase por error y reactivarla recupera su trabajo intacto),
  // pero no cuentan, no entran al reparto y no viajan al servidor — que
  // responde 400 ante una tarea cuya fase no venga en la lista. Sin este
  // filtro, quitar una fase con tareas dejaba el asistente avanzando con un
  // contador inflado y la creacion reventaba al final.
  const tareasActivas = tareas.filter((t) => fasesSeleccionadas.includes(t.fase));

  // Espeja la creacion de tareas del servidor: cada tarea de Madera genera 2
  // subfases (Instalación + Detallado y lustro), y CUALQUIER tarea con
  // tipo_unidad_id solo aplica a las unidades de ese tipo — el servidor filtra
  // por tipo en todas las fases, no solo en Madera.
  const totalTareasGlobal = subtipo === "ZONAS_COMUNES"
    ? tareasActivas.length * zonasSeleccionadas.length
    : tareasActivas.reduce((acc, t) => {
        const isMadera = t.fase === "Madera";
        const unidadesAplicables = t.tipo_unidad_id
          ? (unidadesPorTipo[t.tipo_unidad_id] ?? 0)
          : totalUnidades;
        const subfasesPorTarea = isMadera ? (t.lustro_excluido ? 1 : 2) : 1;
        return acc + unidadesAplicables * subfasesPorTarea;
      }, 0);

  // ── El reparto, en vivo ───────────────────────────────────────────────────
  // Se recalcula en cada render a proposito: es puro y barato (recorre los dias
  // de la obra una vez), y memorizarlo obligaria a listar como dependencias las
  // ocho piezas de estado de las que depende — la primera que se olvide deja al
  // asistente validando contra un cronograma viejo.
  const fasesReparto: FaseReparto[] = fasesSeleccionadas.map((f, i) => ({
    nombre: f,
    orden: i + 1,
    dias: faseDias[f] ?? null,
    ventana: faseVentanas[f] ?? null,
  }));
  const tareasReparto: TareaReparto[] = tareasActivas.map((t) => ({
    id: t.id,
    fase: t.fase,
    dias: t.tiempo_acordado_dias,
    ventana: tareaVentanas[t.id] ?? null,
  }));
  const reparto = repartirCronograma({
    inicio: fechaInicio,
    fin: fechaFin,
    diasHabilesSemana: diasHabiles,
    modo: modoCronograma,
    fases: fasesReparto,
    tareas: tareasReparto,
  });

  /**
   * Propone ventanas con el reparto AUTOMATICO y las escribe donde hagan falta.
   *
   * `forzar = false` (al entrar al paso 2, o al cambiar de modo) rellena SOLO
   * los huecos: lo que el usuario ya escribio es suyo y no se pisa. `forzar =
   * true` es el boton explicito «recalcular», el unico sitio donde el sistema
   * tiene permiso para sobrescribir — porque lo pidio el usuario.
   */
  function proponerVentanas(modo: ModoCronograma, forzar: boolean) {
    if (modo === "AUTOMATICO") return; // ahi no hay nada que rellenar: lo pone todo el servidor
    const fasesBase: FaseReparto[] = fasesSeleccionadas.map((f, i) => ({
      nombre: f, orden: i + 1, dias: faseDias[f] ?? null,
    }));
    const tareasBase: TareaReparto[] = tareas.map((t) => ({
      id: t.id, fase: t.fase, dias: t.tiempo_acordado_dias,
    }));

    const auto = repartirCronograma({
      inicio: fechaInicio, fin: fechaFin, diasHabilesSemana: diasHabiles,
      modo: "AUTOMATICO", fases: fasesBase, tareas: tareasBase,
    });
    if (!auto.ok) return;

    const nuevasFases: Record<string, VentanaPlan> = { ...faseVentanas };
    for (const f of fasesSeleccionadas) {
      const actual = nuevasFases[f];
      if (!forzar && actual?.inicio && actual?.fin) continue;
      const v = auto.fases.get(f);
      if (v) nuevasFases[f] = { inicio: fechaISO(v.inicio), fin: fechaISO(v.fin) };
    }
    setFaseVentanas(nuevasFases);

    if (modo !== "MANUAL") return;

    // Las tareas se proponen DENTRO de las ventanas de fase que acaban de
    // quedar fijadas, no dentro del reparto automatico: si el usuario ya movio
    // una fase, sus tareas tienen que caer donde el la puso.
    const porFases = repartirCronograma({
      inicio: fechaInicio, fin: fechaFin, diasHabilesSemana: diasHabiles,
      modo: "FASES",
      fases: fasesBase.map((f) => ({ ...f, ventana: nuevasFases[f.nombre] ?? null })),
      tareas: tareasBase,
    });
    if (!porFases.ok) return;
    const nuevasTareas: Record<string, VentanaPlan> = { ...tareaVentanas };
    for (const t of tareas) {
      const actual = nuevasTareas[t.id];
      if (!forzar && actual?.inicio && actual?.fin) continue;
      const v = porFases.tareas.get(t.id);
      if (v) nuevasTareas[t.id] = { inicio: fechaISO(v.inicio), fin: fechaISO(v.fin) };
    }
    setTareaVentanas(nuevasTareas);
  }

  // Validation
  const canProceed1 = nombre.trim().length >= 3 && numeroRegistro.trim().length >= 2 && (
    subtipo === "ZONAS_COMUNES"
      ? zonasSeleccionadas.length > 0
      : edificios.length > 0
        && edificios.every((e) => {
          const upiso = e.unidades_por_piso ?? 0;
          if (!e.nombre || e.pisos <= 0 || upiso <= 0) return false;
          const distSum = Object.values(e.distribucion).reduce((s, d) => s + (d.derecha ?? 0) + (d.izquierda ?? 0), 0);
          // Distribución debe cuadrar exactamente con la capacidad de la torre,
          // si no, el servidor crea menos/más unidades de las que muestra la preview.
          return distSum === e.pisos * upiso;
        })
        && tiposUnidad.every((t) => t.espacios.length > 0)
    )
    && excesosMetraje(tiposUnidad).length === 0
    // Las fechas de obra son obligatorias al CREAR. Al editar no se exigen:
    // en produccion hay obras antiguas sin fecha de fin, y bloquearles la ficha
    // obligaria a inventarse una fecha para poder cambiar un nombre — y esa
    // fecha inventada alimentaria despues el cronograma.
    && (isEditMode || faltantesFechasObra(fechaInicio, fechaFin).length === 0);
  // El cronograma entra en `canProceed2` porque es en el paso 2 donde se
  // rellena: sin ventanas validas no se puede crear el proyecto, y descubrirlo
  // en el paso 3 -tras asignar contratistas- seria hacerle perder el trabajo.
  const canProceed2 = allEspacios.length > 0 && fasesSeleccionadas.length > 0 && tareasActivas.length > 0
    && reparto.ok;

  const [pendingOverrides, setPendingOverrides] = useState<AsignacionOverride[] | undefined>(undefined);

  async function handleSubmit(resolvedTareas?: TareaInput[], overrides?: AsignacionOverride[]) {
    if (isEditMode && !showPasswordModal) {
      setPendingTareas(resolvedTareas);
      setPendingOverrides(overrides);
      setPassword("");
      setShowPassword(false);
      setError("");
      setShowPasswordModal(true);
      return;
    }

    setLoading(true);
    setError("");

    // El filtro de fase se aplica a los TRES origenes: `resolvedTareas` y
    // `pendingTareas` derivan del mismo estado y podrian arrastrar tareas
    // de una fase quitada despues de haberse calculado.
    const tareasToSend = (resolvedTareas ?? pendingTareas ?? tareas)
      .filter((t) => fasesSeleccionadas.includes(t.fase));
    const asignacionesToSend = overrides ?? pendingOverrides ?? asignaciones;

    if (totalTareasGlobal > 5000) {
      setError(`Demasiadas tareas (${totalTareasGlobal}). Reduce el tamaño del proyecto o las tareas por unidad.`);
      setLoading(false);
      return;
    }

    const esZonasComunes = subtipo === "ZONAS_COMUNES";

    const payload = {
      ...(isEditMode ? { password } : {}),
      nombre,
      numero_registro: numeroRegistro.trim().toUpperCase(),
      contratista_default_id: contratistaDefaultId,
      cliente_id: clienteId || undefined,
      subtipo,
      dias_habiles_semana: diasHabiles,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin_estimada: fechaFin || undefined,
      ubicacion_lat: ubicacion?.lat ?? null,
      ubicacion_lng: ubicacion?.lng ?? null,
      tipos_unidad: tiposUnidad.map((t) => ({
        nombre: t.nombre,
        espacios: t.espacios,
        ...(metrosEnabled && t.metraje_total != null ? { metraje_total: t.metraje_total } : {}),
        ...(metrosEnabled && t.metrajes_espacios && Object.keys(t.metrajes_espacios).length > 0
          ? { metrajes_espacios: t.metrajes_espacios } : {}),
      })),
      edificios: esZonasComunes ? [] : edificios.map((e) => ({
        nombre: e.nombre,
        pisos: e.pisos,
        unidadesPorPiso: e.unidades_por_piso,
        distribucion: Object.fromEntries(
          Object.entries(e.distribucion).map(([tipoId, dist]) => {
            const tipo = tiposUnidad.find((t) => t.id === tipoId);
            return [tipo?.nombre ?? tipoId, dist];
          })
        ),
        ...(e.unidades_detalle ? {
          unidades_detalle: Object.fromEntries(
            Object.entries(e.unidades_detalle).map(([piso, units]) => [
              piso,
              units.map((u) => ({
                nombre: u.nombre,
                tipo_unidad: tiposUnidad.find((t) => t.id === u.tipo_unidad_id)?.nombre ?? u.tipo_unidad_id,
                sentido: u.sentido,
                nombre_personalizado: u.nombre_personalizado,
              })),
            ])
          ),
        } : {}),
      })),
      espacios: allEspacios,
      // El modo viaja SIEMPRE: es lo que le dice al servidor que partes del
      // cronograma son suyas y cuales del usuario. Las ventanas solo viajan
      // cuando el modo dice que las pone el usuario — mandar las de fase en
      // AUTOMATICO seria darle al servidor una version vieja de lo que el
      // mismo va a calcular.
      // Se manda SOLO si alguien lo eligio de verdad. Mandarlo siempre
      // convertia cualquier edicion en un alta de cronograma silenciosa.
      ...(modoElegido ? { modo_cronograma: modoCronograma } : {}),
      fases: fasesSeleccionadas.map((f) => ({
        nombre: f,
        ...(faseDias[f] != null ? { tiempo_estimado_dias: faseDias[f] } : {}),
        ...(modoCronograma !== "AUTOMATICO" && faseVentanas[f]?.inicio && faseVentanas[f]?.fin
          ? { fecha_inicio_plan: faseVentanas[f]!.inicio, fecha_fin_plan: faseVentanas[f]!.fin }
          : {}),
      })),
      tareas: tareasToSend.map(({ id: _id, tipo_unidad_id, ...rest }) => ({
        ...rest,
        // Translate local tipo ID -> tipo nombre, since the server matches by nombre.
        ...(tipo_unidad_id
          ? { tipo_unidad_id: tiposUnidad.find((tu) => tu.id === tipo_unidad_id)?.nombre ?? tipo_unidad_id }
          : {}),
        ...(modoCronograma === "MANUAL" && tareaVentanas[_id]?.inicio && tareaVentanas[_id]?.fin
          ? { fecha_inicio_plan: tareaVentanas[_id]!.inicio, fecha_fin_plan: tareaVentanas[_id]!.fin }
          : {}),
      })),
      zonas_comunes: tieneZonasComunes || esZonasComunes ? zonasSeleccionadas : [],
      ...(metrosEnabled && Object.keys(metrosZonas).length > 0
        ? { zonas_comunes_metrajes: metrosZonas } : {}),
      personas: personas
        .filter((p) => p.nombre.trim())
        .map(({ id: _id, ...rest }) => rest),
      asignaciones: asignacionesToSend.length > 0 ? asignacionesToSend : undefined,
    };

    try {
      const endpoint = isEditMode
        ? `/api/proyectos/${initialData!.projectId}/wizard`
        : "/api/proyectos/wizard";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (isEditMode) {
          // Los avisos del servidor son lo que NO se toco por ser del usuario
          // (p. ej. ventanas de fase que no se movieron al cambiar las fechas
          // de la obra). Se ensenan: un cambio silencioso que no ocurre es tan
          // desconcertante como uno que ocurre sin avisar.
          const datos = await res.json().catch(() => null);
          const avisos: string[] = Array.isArray(datos?.avisos) ? datos.avisos : [];
          setSuccessMsg(
            avisos.length > 0
              ? `Cambios guardados. ${avisos.join(" ")} Redirigiendo…`
              : "Cambios guardados correctamente. Redirigiendo…",
          );
          setLoading(false);
          setTimeout(() => {
            router.push(`/dashboard/proyectos/${initialData!.projectId}`);
          }, 1200);
          return;
        } else {
          const data = await res.json();
          // El proyecto ya existe: el borrador cumplió y se va. Dejarlo haría
          // que la próxima visita ofreciera «retomar» una obra ya creada.
          if (claveB) borrarBorrador(claveB);
          router.push(`/dashboard/proyectos/${data.id}`);
        }
      } else {
        const data = await res.json();
        setError(data.error ?? "Error guardando proyecto");
        setLoading(false);
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
      setLoading(false);
    } finally {
      setShowPasswordModal(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      {/* Back link */}
      <Link
        href={isEditMode ? `/dashboard/proyectos/${initialData.projectId}` : "/dashboard/proyectos"}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Volver a proyectos
      </Link>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-blue-600 text-white" : step > s ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
            }`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm font-medium ${step >= s ? "text-slate-800" : "text-slate-400"}`}>
              {s === 1 ? "Estructura" : s === 2 ? "Tareas" : "Asignar y crear"}
            </span>
            {s < 3 && <div className="w-6 h-px bg-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Aviso de borrador: SIEMPRE una decisión explícita del usuario.
          Restaurar en silencio metería datos rancios sin que nadie lo note;
          mientras el aviso esté visible, el autoguardado está en pausa para
          no pisar el borrador antes de que el usuario elija. */}
      {decisionBorrador === "pendiente" && borradorGuardado && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">
            Tienes un borrador sin terminar de este asistente ({edadLegible(borradorGuardado.guardadoEn)}).
          </p>
          <p className="mt-1 text-blue-800">
            {borradorGuardado.datos.nombre.trim()
              ? `Proyecto «${borradorGuardado.datos.nombre.trim()}», paso ${borradorGuardado.step} de 3.`
              : `Quedó en el paso ${borradorGuardado.step} de 3.`}{" "}
            Si empiezas de nuevo, el borrador se elimina.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={retomarBorrador}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Retomar borrador
            </button>
            <button
              type="button"
              onClick={descartarBorrador}
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 cursor-pointer"
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <WizardStep1
          nombre={nombre} setNombre={setNombre}
          numeroRegistro={numeroRegistro} setNumeroRegistro={setNumeroRegistro}
          contratistaDefaultId={contratistaDefaultId}
          setContratistaDefaultId={setContratistaDefaultId}
          contratistas={contratistas}
          contratistasProyecto={contratistasProyecto}
          onToggleContratistaProyecto={toggleContratistaProyecto}
          preseleccionHabituales={habitualesIniciales.length > 0}
          isEditMode={isEditMode}
          clienteId={clienteId} setClienteId={setClienteId}
          clientes={clientes}
          subtipo={subtipo} setSubtipo={setSubtipo}
          diasHabiles={diasHabiles} setDiasHabiles={setDiasHabiles}
          fechaInicio={fechaInicio} setFechaInicio={setFechaInicio}
          fechaFin={fechaFin} setFechaFin={setFechaFin}
          ubicacion={ubicacion} setUbicacion={setUbicacion}
          tiposUnidad={tiposUnidad} setTiposUnidad={setTiposUnidad}
          edificios={edificios} setEdificios={setEdificios}
          tieneZonasComunes={tieneZonasComunes} setTieneZonasComunes={setTieneZonasComunes}
          zonasSeleccionadas={zonasSeleccionadas} setZonasSeleccionadas={setZonasSeleccionadas}
          metrosEnabled={metrosEnabled} onMetrosEnabledChange={setMetrosEnabled}
          metrosZonas={metrosZonas} onMetrosZonasChange={setMetrosZonas}
          canProceed={canProceed1}
          onNext={() => {
            // Solo se propone si la obra YA tenia cronograma o si es una obra
            // nueva. A una obra vieja sin plan no se le inventa uno por el solo
            // hecho de abrir su ficha.
            if (!isEditMode || teniaCronograma) proponerVentanas(modoCronograma, false);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <WizardStep2
          allEspacios={allEspacios}
          fasesSeleccionadas={fasesSeleccionadas}
          setFasesSeleccionadas={setFasesSeleccionadas}
          tareas={tareas}
          setTareas={setTareas}
          faseDias={faseDias}
          onFaseDiasChange={(fase, dias) => setFaseDias((prev) => ({ ...prev, [fase]: dias }))}
          modoCronograma={modoCronograma}
          onModoCronogramaChange={(modo) => {
            // Tocar el selector ES elegir: a partir de aqui el cronograma viaja
            // al servidor. Antes de esto, una obra sin plan sigue sin plan.
            setModoElegido(true);
            setModoCronograma(modo);
            proponerVentanas(modo, false);
          }}
          faseVentanas={faseVentanas}
          onFaseVentanaChange={(fase, campo, valor) =>
            setFaseVentanas((prev) => ({ ...prev, [fase]: { ...prev[fase], [campo]: valor || undefined } }))
          }
          tareaVentanas={tareaVentanas}
          onTareaVentanaChange={(tareaId, campo, valor) =>
            setTareaVentanas((prev) => ({ ...prev, [tareaId]: { ...prev[tareaId], [campo]: valor || undefined } }))
          }
          onCompletarVentanas={() => proponerVentanas(modoCronograma, false)}
          onRecalcularVentanas={() => proponerVentanas(modoCronograma, true)}
          reparto={reparto}
          fechaInicioObra={fechaInicio}
          fechaFinObra={fechaFin}
          diasHabilesSemana={diasHabiles}
          canProceed={canProceed2}
          onNext={() => {
            // La siembra ocurre al ENTRAR al paso 3, no antes: es el ultimo
            // momento en que las fases ya son definitivas (el paso 2 puede
            // agregarlas o quitarlas) y los pools vacios siguen vacios.
            sembrarPool();
            setStep(3);
          }}
          onBack={() => setStep(1)}
          tareasAprendidas={tareasAprendidas}
          tiposUnidad={tiposUnidad}
          muestraEconomia={muestraEconomia}
        />
      )}

      {step === 3 && (
        <WizardStep3
          nombre={nombre}
          subtipo={subtipo}
          diasHabiles={diasHabiles}
          edificios={edificios}
          tiposUnidad={tiposUnidad}
          fasesSeleccionadas={fasesSeleccionadas}
          tareas={tareas}
          contratistas={contratistas}
          totalUnidades={totalUnidades}
          totalTareasGlobal={totalTareasGlobal}
          loading={loading}
          isEditMode={isEditMode}
          personas={personas}
          setPersonas={setPersonas}
          asignaciones={asignaciones}
          setAsignaciones={setAsignaciones}
          pool={pool}
          addToPool={addToPool}
          removeFromPool={removeFromPool}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
        />
      )}
      {/* Password modal for edit mode */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Confirmar cambios</h3>
              <button onClick={() => { setShowPasswordModal(false); setError(""); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Ingresa tu contraseña de administrador para guardar los cambios del proyecto.</p>

            <div className="relative mb-3">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && password && handleSubmit()}
                placeholder="Contraseña"
                autoFocus
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600 mb-3">{error}</p>
            )}

            {successMsg && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                {successMsg}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowPasswordModal(false); setError(""); }}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSubmit()}
                disabled={loading || !password}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
