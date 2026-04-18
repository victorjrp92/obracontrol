"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import type { Contratista, TipoUnidadInput, EdificioInput, TareaInput } from "./wizard-types";
import WizardStep1 from "./WizardStep1";
import WizardStep2 from "./WizardStep2";
import WizardStep3 from "./WizardStep3";

export default function WizardClient({ contratistas }: { contratistas: Contratista[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 state
  const [nombre, setNombre] = useState("");
  const [subtipo, setSubtipo] = useState<"APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES">("APARTAMENTOS");
  const [diasHabiles, setDiasHabiles] = useState(5);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tiposUnidad, setTiposUnidad] = useState<TipoUnidadInput[]>([
    { id: "t1", nombre: "Tipo estandar", espacios: ["Cocina", "Bano principal", "Habitacion principal", "Sala-comedor"] },
  ]);
  const [edificios, setEdificios] = useState<EdificioInput[]>([
    { nombre: "Torre 1", pisos: 5, distribucion: { "t1": 4 } },
  ]);
  const [tieneZonasComunes, setTieneZonasComunes] = useState(false);
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>([]);

  // Step 2 state
  const allEspacios = [...new Set(tiposUnidad.flatMap((t) => t.espacios))];
  const [fasesSeleccionadas, setFasesSeleccionadas] = useState<string[]>(["Madera", "Obra Blanca"]);
  const [tareas, setTareas] = useState<TareaInput[]>([]);

  // Computed
  const totalUnidades = subtipo === "ZONAS_COMUNES" ? 0 : edificios.reduce((acc, e) => {
    const perFloor = Object.values(e.distribucion).reduce((s, n) => s + n, 0);
    return acc + e.pisos * perFloor;
  }, 0);
  const totalTareasGlobal = subtipo === "ZONAS_COMUNES"
    ? tareas.length * zonasSeleccionadas.length
    : totalUnidades * tareas.length;

  // Validation
  const canProceed1 = nombre.trim().length >= 3 && (
    subtipo === "ZONAS_COMUNES"
      ? zonasSeleccionadas.length > 0
      : edificios.length > 0
        && edificios.every((e) => e.nombre && e.pisos > 0 && Object.values(e.distribucion).some((n) => n > 0))
        && tiposUnidad.every((t) => t.espacios.length > 0)
  );
  const canProceed2 = allEspacios.length > 0 && fasesSeleccionadas.length > 0 && tareas.length > 0;

  async function handleSubmit() {
    setLoading(true);
    setError("");

    if (totalTareasGlobal > 5000) {
      setError(`Demasiadas tareas (${totalTareasGlobal}). Reduce el tamano del proyecto o las tareas por unidad.`);
      setLoading(false);
      return;
    }

    const esZonasComunes = subtipo === "ZONAS_COMUNES";

    const payload = {
      nombre,
      subtipo,
      dias_habiles_semana: diasHabiles,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin_estimada: fechaFin || undefined,
      tipos_unidad: tiposUnidad.map((t) => ({ nombre: t.nombre, espacios: t.espacios })),
      edificios: esZonasComunes ? [] : edificios.map((e) => ({
        nombre: e.nombre,
        pisos: e.pisos,
        distribucion: Object.fromEntries(
          Object.entries(e.distribucion).map(([tipoId, count]) => {
            const tipo = tiposUnidad.find((t) => t.id === tipoId);
            return [tipo?.nombre ?? tipoId, count];
          })
        ),
      })),
      espacios: allEspacios,
      fases: fasesSeleccionadas,
      tareas: tareas.map(({ id: _id, ...rest }) => rest),
      zonas_comunes: tieneZonasComunes || esZonasComunes ? zonasSeleccionadas : [],
    };

    const res = await fetch("/api/proyectos/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/proyectos/${data.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error creando proyecto");
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      {/* Back link */}
      <Link
        href="/dashboard/proyectos"
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
          subtipo={subtipo} setSubtipo={setSubtipo}
          diasHabiles={diasHabiles} setDiasHabiles={setDiasHabiles}
          fechaInicio={fechaInicio} setFechaInicio={setFechaInicio}
          fechaFin={fechaFin} setFechaFin={setFechaFin}
          tiposUnidad={tiposUnidad} setTiposUnidad={setTiposUnidad}
          edificios={edificios} setEdificios={setEdificios}
          tieneZonasComunes={tieneZonasComunes} setTieneZonasComunes={setTieneZonasComunes}
          zonasSeleccionadas={zonasSeleccionadas} setZonasSeleccionadas={setZonasSeleccionadas}
          canProceed={canProceed1}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <WizardStep2
          allEspacios={allEspacios}
          fasesSeleccionadas={fasesSeleccionadas}
          setFasesSeleccionadas={setFasesSeleccionadas}
          tareas={tareas}
          setTareas={setTareas}
          canProceed={canProceed2}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <WizardStep3
          nombre={nombre}
          subtipo={subtipo}
          diasHabiles={diasHabiles}
          edificios={edificios}
          fasesSeleccionadas={fasesSeleccionadas}
          tareas={tareas}
          setTareas={setTareas}
          contratistas={contratistas}
          totalUnidades={totalUnidades}
          totalTareasGlobal={totalTareasGlobal}
          loading={loading}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  );
}
