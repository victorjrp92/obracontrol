import { validateObreroToken } from "@/lib/data-obrero";
import ObreroLayout from "@/components/obrero/ObreroLayout";

export default async function ObreroTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validación centralizada (existe, activo, dentro de fechas) + freno de carga.
  // Antes esto consultaba `prisma.obrero` directamente y se saltaba ambas cosas:
  // la puerta de entrada del obrero era la única ruta de token sin protección,
  // y su criterio de validez podía divergir del de la ruta de detalle — que es
  // justo lo que producía la pantalla en blanco cuando no coincidían.
  const obrero = await validateObreroToken(token);

  if (!obrero) {
    return (
      <html lang="es" className="h-full">
        <body className="min-h-full flex flex-col antialiased">
          <div className="min-h-dvh flex items-center justify-center bg-slate-50 px-6">
            <div className="text-center max-w-sm">
              <img
                src="/seiricon-icon.png"
                alt="Seiricon"
                className="w-16 h-16 mx-auto mb-6"
              />
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                Enlace no válido
              </h1>
              <p className="text-base text-slate-500 leading-relaxed">
                Este enlace ha expirado o fue desactivado. Contacta a tu
                contratista para obtener un nuevo enlace.
              </p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <ObreroLayout
      obreroNombre={obrero.nombre}
      contratistaNombre={obrero.contratista.nombre}
      token={token}
    >
      {children}
    </ObreroLayout>
  );
}
