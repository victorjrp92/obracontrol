"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, Eye, EyeOff, Loader2, X } from "lucide-react";
import type { Contratista, TipoUnidadInput, EdificioInput, TareaInput, EditModeData, PersonaProyectoInput, AsignacionOverride, UbicacionInput, VentanaPlan } from "./wizard-types";
import type { TaskTemplate } from "@/lib/task-templates";
import { excesosMetraje } from "@/lib/metraje";
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
  initialData,
  tareasAprendidas,
  muestraEconomia,
}: {
  contratistas: Contratista[];
  initialData?: EditModeData;
  tareasAprendidas?: Record<string, Record<string, TaskTemplate[]>>;
  /**
   * Si el asistente ensena el dinero de la obra. SIN DEFECTO a proposito: un
   * defecto convierte "se me olvido pasarla" en un numero plausible y nadie lo
   * nota. Sin el, cualquier pantalla nueva que monte el asistente no compila
   * hasta decidir que hace con el dinero.
   */
  muestraEconomia: boolean;
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
  const [contratistaDefaultId, setContratistaDefaultId] = useState(initialData?.contratistaDefaultId ?? "");
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
  // Mirror the server's tarea creation: each Madera task generates 2 subfases (Instalación + Detallado y lustro)
  // and Madera tasks with tipo_unidad_id only apply to units of that type.
  const totalTareasGlobal = subtipo === "ZONAS_COMUNES"
    ? tareas.length * zonasSeleccionadas.length
    : tareas.reduce((acc, t) => {
        const isMadera = t.fase === "Madera";
        const unidadesAplicables = isMadera && t.tipo_unidad_id
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
  const tareasReparto: TareaReparto[] = tareas.map((t) => ({
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
  const canProceed2 = allEspacios.length > 0 && fasesSeleccionadas.length > 0 && tareas.length > 0
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

    const tareasToSend = resolvedTareas ?? pendingTareas ?? tareas;
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

      {step === 1 && (
        <WizardStep1
          nombre={nombre} setNombre={setNombre}
          numeroRegistro={numeroRegistro} setNumeroRegistro={setNumeroRegistro}
          contratistaDefaultId={contratistaDefaultId} setContratistaDefaultId={setContratistaDefaultId}
          contratistas={contratistas}
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
          onNext={() => setStep(3)}
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
