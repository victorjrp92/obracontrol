"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";

export default function ExcelButtons({ proyectoId }: { proyectoId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ importadas?: number; errores?: string[] } | null>(null);
  const router = useRouter();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/proyectos/${proyectoId}/importar-tareas`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ errores: data.errores ?? [data.error ?? "Error al importar"] });
      } else {
        setResult({ importadas: data.importadas, errores: data.errores });
        router.refresh();
      }
    } catch {
      setResult({ errores: ["Error de conexion"] });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <a
          href={`/api/proyectos/${proyectoId}/plantilla`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Descargar plantilla Excel
        </a>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Importando..." : "Subir tareas desde Excel"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      {result && (
        <div className={`text-xs px-3 py-2 rounded-lg ${result.importadas ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {result.importadas !== undefined && result.importadas > 0 && (
            <p className="font-medium">{result.importadas} tareas importadas correctamente</p>
          )}
          {result.errores && result.errores.length > 0 && (
            <ul className="mt-1 list-disc list-inside">
              {result.errores.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {result.errores.length > 5 && <li>...y {result.errores.length - 5} errores mas</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
