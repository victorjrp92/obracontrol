/**
 * Cola offline para evidencias.
 *
 * Guarda evidencias (File + metadata) en IndexedDB cuando el cliente está
 * offline o el upload falla. Reintenta al detectar conexión (evento `online`)
 * o explícitamente vía `flushEvidenceQueue()`.
 *
 * Uso desde un componente cliente:
 *
 *   import { enqueueEvidence, flushEvidenceQueue, getEvidenceQueueSize } from "@/lib/offline-queue";
 *
 *   try {
 *     await fetch("/api/evidencias", { method: "POST", body: formData });
 *   } catch {
 *     await enqueueEvidence({ tareaId, tipo, file, gpsLat, gpsLng, timestamp: Date.now() });
 *   }
 *
 *   window.addEventListener("online", () => flushEvidenceQueue());
 */

const DB_NAME = "obracontrol-offline";
const DB_VERSION = 1;
const STORE = "evidencia-queue";

export interface QueuedEvidence {
  id?: number;
  tareaId: string;
  tipo: "FOTO" | "VIDEO";
  file: Blob;
  fileName: string;
  fileType: string;
  gpsLat: number | null;
  gpsLng: number | null;
  timestamp: number;
  retries: number;
  lastError?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueEvidence(
  data: Omit<QueuedEvidence, "id" | "retries">
): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.add({ ...data, retries: 0 });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getEvidenceQueueSize(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listQueue(): Promise<QueuedEvidence[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedEvidence[]);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updateRetry(id: number, error: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result as QueuedEvidence | undefined;
      if (item) {
        item.retries += 1;
        item.lastError = error;
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Reintenta todas las evidencias en cola. Retorna {sent, failed}.
 * No lanza — acumula fallos en el registro de retries.
 */
export async function flushEvidenceQueue(): Promise<{
  sent: number;
  failed: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { sent: 0, failed: 0 };
  }

  const items = await listQueue();
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    if (item.id == null) continue;
    try {
      const fd = new FormData();
      fd.append(
        "file",
        new File([item.file], item.fileName, { type: item.fileType })
      );
      fd.append("tarea_id", item.tareaId);
      fd.append("tipo", item.tipo);
      if (item.gpsLat != null) fd.append("gps_lat", String(item.gpsLat));
      if (item.gpsLng != null) fd.append("gps_lng", String(item.gpsLng));
      fd.append("timestamp_captura", new Date(item.timestamp).toISOString());

      const res = await fetch("/api/evidencias", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await removeFromQueue(item.id);
      sent += 1;
    } catch (err) {
      failed += 1;
      await updateRetry(
        item.id,
        err instanceof Error ? err.message : "Error desconocido"
      );
    }
  }

  return { sent, failed };
}

/**
 * Registra listeners globales para drenar la cola cuando vuelva la conexión.
 * Llamar una sola vez desde un componente top-level del dashboard.
 */
export function installOnlineFlushListener(onFlush?: (r: { sent: number; failed: number }) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = async () => {
    const r = await flushEvidenceQueue();
    onFlush?.(r);
  };
  window.addEventListener("online", handler);
  // Intentar flush inmediato al montar (por si quedó algo de sesión anterior)
  if (navigator.onLine) handler();
  return () => window.removeEventListener("online", handler);
}
