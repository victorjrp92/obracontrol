import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";
import { canManageUsers } from "@/lib/access";
import { puede } from "@/lib/plan";
import Topbar from "@/components/dashboard/Topbar";
import PerfilForm from "./PerfilForm";
import EmpresaSeccion from "./EmpresaSeccion";

export default async function PerfilPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const nivel = usuario.rol_ref.nivel_acceso;
  const tipoCuenta = usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA";

  /**
   * MISMA condición que gobernaba la pestaña «Empresa» del menú lateral, no una
   * nueva. Se compone de las dos mitades que la sostenían:
   *
   *  - `puede(tipoCuenta, "empresa")`: la capacidad «ficha/pestaña de empresa»
   *    de plan.ts, true sólo para CONSTRUCTORA. Las cuentas personales (B2C)
   *    nunca tuvieron la pestaña — su menú lo arma `modulosVisibles()`, que no
   *    la incluye— aunque su dueño sea ADMIN_GENERAL y pasase `canManageUsers`.
   *  - `canManageUsers(nivel)`: la guarda real que ya tenía /dashboard/empresa
   *    y que sigue teniendo PATCH|GET /api/constructora. Deja ADMIN_GENERAL y
   *    DIRECTIVO; SUPER_ADMIN también la pasa, pero el layout de (dashboard) lo
   *    manda a /super-admin antes de llegar aquí.
   *
   * Resultado dentro de este shell: ADMIN_GENERAL y DIRECTIVO de una cuenta
   * CONSTRUCTORA. Exactamente quienes veían la pestaña. ADMIN_PROYECTO,
   * CONTRATISTA, OBRERO y PERSONAL_CAMPO siguen sin ver NIT ni datos fiscales.
   */
  const veFichaEmpresa = puede(tipoCuenta, "empresa") && canManageUsers(nivel);

  // Los dos COUNT sólo se pagan si la sección se va a pintar.
  const [totalUsuarios, proyectosActivos] = veFichaEmpresa
    ? await Promise.all([
        prisma.usuario.count({
          where: { constructora_id: usuario.constructora_id },
        }),
        prisma.proyecto.count({
          where: { constructora_id: usuario.constructora_id, estado: "ACTIVO" },
        }),
      ])
    : [0, 0];

  const c = usuario.constructora;

  return (
    <>
      <Topbar title="Mi perfil" />
      <PerfilForm
        nombre={usuario.nombre}
        email={usuario.email}
        telefono={usuario.telefono}
        avatarUrl={usuario.avatar_url}
        rol={usuario.rol_ref.nombre}
        nivelAcceso={usuario.rol_ref.nivel_acceso ?? ""}
        constructora={usuario.constructora?.nombre ?? ""}
      >
        {veFichaEmpresa && (
          <EmpresaSeccion
            nombre={c.nombre}
            nit={c.nit}
            direccion={c.direccion}
            ciudad={c.ciudad}
            telefono={c.telefono}
            sitioWeb={c.sitio_web}
            descripcion={c.descripcion}
            totalUsuarios={totalUsuarios}
            proyectosActivos={proyectosActivos}
            // Ver la ficha y poder guardarla son el mismo permiso hoy
            // (`canManageUsers` en api/constructora), pero se pasa explícito
            // para que el día que se separen no haya que adivinar.
            puedeEditar={canManageUsers(nivel)}
          />
        )}
      </PerfilForm>
    </>
  );
}
