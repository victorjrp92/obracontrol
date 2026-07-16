import { permanentRedirect } from "next/navigation";

/** La vista previa ya es oficial: /go-nueva redirige a la ruta real /go. */
export default function GoNuevaRedirect() {
  permanentRedirect("/go");
}
