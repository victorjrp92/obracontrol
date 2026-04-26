"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import {
  flushEvidenceQueue,
  getEvidenceQueueSize,
  installOnlineFlushListener,
} from "@/lib/offline-queue";

/**
 * Badge que muestra evidencias pendientes de sincronizar y permite forzar
 * un flush manual. Monta también el listener global `online` para drenar
 * automáticamente al volver la red.
 */
export default function OfflineQueueBadge() {
  const [size, setSize] = useState(0);
  const [flushing, setFlushing] = useState(false);

  async function refresh() {
    try {
      setSize(await getEvidenceQueueSize());
    } catch {
      // IndexedDB aún no listo — ignorar
    }
  }

  useEffect(() => {
    refresh();
    const uninstall = installOnlineFlushListener(() => refresh());
    const interval = setInterval(refresh, 15_000);
    return () => {
      uninstall();
      clearInterval(interval);
    };
  }, []);

  async function handleFlush() {
    setFlushing(true);
    try {
      await flushEvidenceQueue();
      await refresh();
    } finally {
      setFlushing(false);
    }
  }

  if (size === 0) return null;

  return (
    <button
      type="button"
      onClick={handleFlush}
      disabled={flushing}
      className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
      title="Evidencias pendientes de sincronizar"
    >
      {flushing ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      {size} pendiente{size !== 1 ? "s" : ""}
    </button>
  );
}
