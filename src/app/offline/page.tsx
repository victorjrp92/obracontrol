import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Sin conexión — ObraControl",
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white">
          <WifiOff className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Sin conexión
        </h1>
        <p className="mt-2 text-slate-600">
          No hay red disponible. Tus tareas y evidencias capturadas se
          sincronizarán automáticamente cuando vuelva la conexión.
        </p>
        <p className="mt-6 text-sm text-slate-500">
          Puedes seguir capturando fotos y reportes; se enviarán al recuperar
          internet.
        </p>
      </div>
    </main>
  );
}
