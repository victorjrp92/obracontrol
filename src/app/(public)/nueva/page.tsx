import { redirect } from "next/navigation";

/** La landing v2 ya es la home: /nueva (ruta de vista previa) redirige a /. */
export default function NuevaRedirect() {
  redirect("/");
}
