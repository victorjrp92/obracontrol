"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";

export default function ReportarButton({ tareaId }: { tareaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReportar() {
    setLoading(true);
    const res = await fetch(`/api/tareas/${tareaId}/reportar`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error al reportar");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleReportar}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
    >
      <Send className="w-4 h-4" />
      {loading ? "Reportando..." : "Reportar como terminada"}
    </button>
  );
}
