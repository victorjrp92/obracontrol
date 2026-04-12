import { prisma } from "@/lib/prisma";
import ObreroLayout from "@/components/obrero/ObreroLayout";

export default async function ObreroTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Lookup obrero by token
  const obrero = await prisma.obrero.findUnique({
    where: { token },
    include: {
      contratista: { select: { nombre: true } },
    },
  });

  // Validate: exists, active, within date range
  const now = new Date();
  const isValid =
    obrero &&
    obrero.activo &&
    now >= obrero.fecha_inicio &&
    now <= obrero.fecha_expiracion;

  if (!isValid) {
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
                Enlace no valido
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
    >
      {children}
    </ObreroLayout>
  );
}
