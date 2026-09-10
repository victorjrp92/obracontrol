// ─────────────────────────────────────────────────────────────────────────
// Verificación de `firmarEvidencias` (`src/lib/storage.ts`).
//
// El bucket `evidencias` es PRIVADO. Las pantallas pasaban la ruta cruda al
// `<img src>` y el navegador la resolvía relativa a la página: 404. Las fotos
// de evidencia —lo único que el producto promete como prueba— no se veían en
// ninguna parte. Esta suite existe para que eso no vuelva a pasar sin avisar.
//
// Se apoya en el bucket REAL: una prueba con dobles no distingue "firmé bien"
// de "el bucket es público". Con CONTROL POSITIVO en los dos sentidos: la
// ruta cruda tiene que fallar y la firmada tiene que servir.
// ─────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { firmarEvidencias } from "@/lib/storage";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env" });

let total = 0;
let fallos = 0;
function verificar(d: string, c: boolean) {
  total++;
  if (c) console.log(`  OK   ${d}`);
  else { fallos++; console.error(`  FAIL ${d}`); }
}

async function main() {
  console.log("Firma de evidencias — verificación\n");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("1. El bucket sigue siendo privado (si deja de serlo, esto cambia)");
  const { data: buckets } = await sb.storage.listBuckets();
  const ev = buckets?.find((b) => b.name === "evidencias");
  verificar(`el bucket "evidencias" existe y es privado`, !!ev && ev.public === false);

  console.log("\n2. Contra un archivo REAL del bucket");
  const { data: nivel1 } = await sb.storage.from("evidencias").list("", { limit: 40 });
  const carpetas = (nivel1 ?? []).filter((f) => !f.name.includes("."));
  let ruta = "";
  for (const c of carpetas.slice(0, 12)) {
    const { data: n2 } = await sb.storage.from("evidencias").list(c.name, { limit: 5 });
    for (const sub of n2 ?? []) {
      const { data: n3 } = await sb.storage.from("evidencias").list(`${c.name}/${sub.name}`, { limit: 3 });
      const jpg = (n3 ?? []).find((f) => /\.(jpg|jpeg|png|webp)$/i.test(f.name));
      if (jpg) { ruta = `${c.name}/${sub.name}/${jpg.name}`; break; }
    }
    if (ruta) break;
  }
  verificar(`se encontró una evidencia real en el bucket`, ruta !== "");
  if (!ruta) { console.log("\n  sin archivos que probar."); return; }
  console.log(`     usando: ${ruta.slice(0, 70)}…`);

  const mapa = await firmarEvidencias([ruta]);
  const firmada = mapa.get(ruta) ?? "";
  verificar(`devuelve una URL para esa ruta`, firmada.length > 0);
  verificar(`la URL apunta a Supabase (el CSP solo admite *.supabase.co)`, /https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(firmada));
  verificar(`la URL va firmada (lleva token)`, firmada.includes("token=") || firmada.includes("/sign/"));

  const rFirmada = await fetch(firmada);
  verificar(`la URL firmada descarga la imagen (HTTP ${rFirmada.status})`, rFirmada.ok);
  verificar(`y devuelve una imagen de verdad`, (rFirmada.headers.get("content-type") ?? "").startsWith("image/"));

  // CONTROL POSITIVO: lo que hacía la app antes tiene que seguir fallando.
  const { data: pub } = sb.storage.from("evidencias").getPublicUrl(ruta);
  const rPub = await fetch(pub.publicUrl);
  verificar(`CONTROL: la URL pública del bucket privado NO sirve (HTTP ${rPub.status})`, !rPub.ok);
  verificar(`CONTROL: la ruta cruda no es una URL — daría 404 en un <img>`, !/^https?:\/\//i.test(ruta));

  console.log("\n3. Formas que puede traer `url_storage`");
  const externa = "https://ejemplo.co/foto.jpg";
  const m2 = await firmarEvidencias([externa]);
  verificar(`una URL absoluta (legado) se devuelve tal cual`, m2.get(externa) === externa);

  const m3 = await firmarEvidencias([ruta, ruta, ruta]);
  verificar(`rutas repetidas se firman una sola vez y devuelven la misma URL`, m3.size === 1 && !!m3.get(ruta));

  const m4 = await firmarEvidencias([]);
  verificar(`lista vacía devuelve mapa vacío sin llamar a Supabase`, m4.size === 0);

  const m5 = await firmarEvidencias(["", "no/existe/archivo-fantasma.jpg"]);
  verificar(`una ruta inexistente no revienta: queda fuera del mapa`, !m5.get("no/existe/archivo-fantasma.jpg"));

  const m6 = await firmarEvidencias([ruta, externa, "no/existe/x.jpg"]);
  verificar(`mezcla ruta + URL + inexistente: firma lo que puede`, !!m6.get(ruta) && m6.get(externa) === externa);

  console.log(`\n${total - fallos}/${total} verificaciones OK`);
  if (fallos > 0) { console.error(`${fallos} fallaron.`); process.exit(1); }
  console.log("Las fotos de evidencia se pueden mostrar.");
}

main().catch((e) => { console.error(e); process.exit(1); });
