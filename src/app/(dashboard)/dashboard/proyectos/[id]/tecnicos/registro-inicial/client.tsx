"use client";

import { useState } from "react";
import { Camera, FileText, TriangleAlert } from "lucide-react";
import PerfilDeFirma from "@/components/documentos/PerfilDeFirma";
import type { EstadoCupo } from "@/lib/productos-tecnicos";
import PanelActaInicial from "@/components/productos-tecnicos/PanelActaInicial";
import RegistroInicialPanel from "@/components/productos-tecnicos/RegistroInicialPanel";
import type { EspacioListado } from "@/components/productos-tecnicos/logica/arbol-espacios";
import type { ActaEnPantalla } from "@/components/productos-tecnicos/logica/vista-acta-inicial";
import type {
  FotoRegistroVista,
  FotoSinMarca,
} from "@/components/productos-tecnicos/logica/vista-registro-inicial";

type Pestana = "REGISTRO" | "ACTA";

/**
 * Las dos mitades del entregable, en el orden en que se hacen: primero se
 * recorre el inmueble tomando fotos, después se emite el acta con ellas.
 *
 * El estado vive AQUÍ, no dentro de cada panel, porque los dos paneles miran lo
 * mismo desde sitios distintos: el de registro pinta las fotos y el del acta
 * necesita saber cuántas hay para decidir si se puede emitir. Duplicarlo dejaría
 * al botón de emitir diciendo «0 fotos» justo después de tomar una, y a la
 * pestaña del acta con un contador que no se mueve al emitirla.
 *
 * Aquí se monta también `PerfilDeFirma`, el otro componente que leaf-4.2 dejó
 * escrito sin pantalla que lo montara. Va en esta página y no en un ajuste
 * aparte porque este es el momento en que hace falta: sin matrícula registrada
 * no se puede firmar el acta, y descubrirlo al pulsar «firmar» sería mandar al
 * profesional a buscar una pantalla de configuración con el documento a medias.
 */
export default function RegistroInicialClient({
  proyectoId,
  espacios,
  fotosIniciales,
  fotosSinMarcaIniciales,
  actasIniciales,
  cupoInicial,
  faltanDatosInmueble,
}: {
  proyectoId: string;
  espacios: EspacioListado[];
  fotosIniciales: FotoRegistroVista[];
  fotosSinMarcaIniciales: FotoSinMarca[];
  actasIniciales: ActaEnPantalla[];
  cupoInicial: EstadoCupo;
  faltanDatosInmueble: boolean;
}) {
  const [pestana, setPestana] = useState<Pestana>("REGISTRO");
  const [fotos, setFotos] = useState<FotoRegistroVista[]>(fotosIniciales);
  const [sinMarca, setSinMarca] = useState<FotoSinMarca[]>(fotosSinMarcaIniciales);
  const [actas, setActas] = useState<ActaEnPantalla[]>(actasIniciales);
  const [cupo, setCupo] = useState<EstadoCupo>(cupoInicial);

  function descartar(id: string) {
    setFotos((previas) => previas.filter((f) => f.id !== id));
    setSinMarca((previas) => previas.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      {faltanDatosInmueble && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Faltan datos del inmueble</p>
            <p className="mt-1 leading-relaxed">
              El acta lleva impresos la dirección y la matrícula inmobiliaria, que es el
              identificador legal del predio. Complétalos en los datos de la obra antes de emitirla;
              las fotos las puedes ir tomando desde ya.
            </p>
          </div>
        </div>
      )}

      <div className="flex w-fit gap-1.5 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setPestana("REGISTRO")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            pestana === "REGISTRO" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <Camera className="h-4 w-4" />
          Registro fotográfico
          <span className="text-xs text-slate-400">{fotos.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setPestana("ACTA")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            pestana === "ACTA" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          <FileText className="h-4 w-4" />
          Acta
          <span className="text-xs text-slate-400">{actas.length}</span>
        </button>
      </div>

      {pestana === "REGISTRO" ? (
        <RegistroInicialPanel
          proyectoId={proyectoId}
          espacios={espacios}
          fotos={fotos}
          fotosSinMarca={sinMarca}
          cupo={cupo}
          onFotoSubida={(foto) => setFotos((previas) => [...previas, foto])}
          onFotoDescartada={descartar}
          onCupo={setCupo}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <PanelActaInicial
            proyectoId={proyectoId}
            actas={actas}
            onActasCambiadas={setActas}
            totalFotos={fotos.length}
            hayFotosSinMarca={sinMarca.length > 0}
          />
          <PerfilDeFirma />
        </div>
      )}
    </div>
  );
}
