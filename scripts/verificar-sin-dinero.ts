// ---------------------------------------------------------------------------
// Verificacion de `sinDinero`: el ultimo filtro antes de serializar.
//
// Lo peligroso de un barrido recursivo no es que no quite lo que debe -eso se
// ve enseguida- sino que se lleve por delante lo que NO debe: una fecha
// convertida en objeto vacio, un array que pierde el orden, un `null` que pasa
// a `{}`. Por eso cada bloque lleva control positivo en los dos sentidos.
// ---------------------------------------------------------------------------
import { sinDinero } from "@/lib/sin-dinero";

/**
 * Camina una ruta dentro del resultado sin recurrir a `any`.
 *
 * El script inspecciona arboles de forma arbitraria -es justo lo que el filtro
 * manipula- y tiparlos uno a uno no aportaria nada: lo que se comprueba es la
 * PRESENCIA o AUSENCIA de una clave, no su tipo.
 */
type Nodo = Record<string, unknown>;
const en = (raiz: unknown, ...ruta: (string | number)[]): unknown =>
  ruta.reduce<unknown>(
    (actual, clave) =>
      actual == null ? undefined : (actual as Nodo)[String(clave)],
    raiz,
  );
const tiene = (valor: unknown, clave: string) =>
  valor != null && Object.prototype.hasOwnProperty.call(valor, clave);

let total = 0;
let fallos = 0;
function verificar(d: string, c: boolean) {
  total++;
  if (c) console.log(`  OK   ${d}`);
  else { fallos++; console.error(`  FAIL ${d}`); }
}

console.log("sinDinero - verificacion\n");

{
  console.log("1. Quita el dinero, a cualquier profundidad");
  const arbol = {
    nombre: "Rosas Cali",
    presupuesto_total: 900_000_000,
    edificios: [{
      nombre: "Torre 1",
      pisos: [{ numero: 3, unidades: [{ nombre: "301", espacios: [{ tareas: [
        { nombre: "Enchape", precio: 250_000, presupuesto_mano_obra: 100_000, estado: "APROBADA" },
      ] }] }] }],
    }],
  };
  const r = sinDinero(arbol) as Nodo;
  verificar("el presupuesto de la raiz desaparece", !tiene(r, "presupuesto_total"));
  const tarea = en(r, "edificios", 0, "pisos", 0, "unidades", 0, "espacios", 0, "tareas", 0);
  verificar("el precio a cinco niveles de profundidad desaparece", !tiene(tarea, "precio"));
  verificar("el presupuesto de mano de obra de la tarea desaparece",
    !tiene(tarea, "presupuesto_mano_obra"));

  // CONTROL POSITIVO: si el barrido se pasara de listo, esto lo caza.
  verificar("el nombre de la obra sigue", r.nombre === "Rosas Cali");
  verificar("el estado de la tarea sigue", en(tarea, "estado") === "APROBADA");
  verificar("el numero de piso sigue (un 3 no es dinero)",
    en(r, "edificios", 0, "pisos", 0, "numero") === 3);
}

{
  console.log("\n2. Lo que NO puede romper");
  const f = new Date("2026-03-10T12:00:00.000Z");
  const r = sinDinero({ fecha_fin_real: f, fecha_inicio: null, tags: ["a", "b"], monto: 5 }) as Nodo;
  verificar("una fecha sigue siendo Date, no un objeto vacio",
    r.fecha_fin_real instanceof Date && r.fecha_fin_real.getTime() === f.getTime());
  verificar("un null sigue siendo null, no {}", r.fecha_inicio === null);
  verificar("un array de strings conserva orden y contenido", String(r.tags) === "a,b");
  verificar("control: el monto SI se fue", !tiene(r, "monto"));
}

{
  console.log("\n3. No muta la entrada");
  // La ruta reutiliza el objeto para contar y agrupar: vaciarselo por debajo
  // produce fallos a distancia dificiles de rastrear.
  const original = { precio: 100, nombre: "x", hijos: [{ precio: 5 }] };
  const copia = sinDinero(original) as Nodo;
  verificar("el original conserva su precio", original.precio === 100);
  verificar("el hijo del original conserva el suyo", original.hijos[0].precio === 5);
  verificar("control: la copia no lo tiene",
    !tiene(copia, "precio") && !tiene(en(copia, "hijos", 0), "precio"));
}

{
  console.log("\n4. Bordes");
  verificar("null entra y sale null", sinDinero(null) === null);
  verificar("undefined entra y sale undefined", sinDinero(undefined) === undefined);
  verificar("un numero suelto pasa igual", sinDinero(42) === 42);
  verificar("un array vacio sigue siendo array", Array.isArray(sinDinero([])));
  const anidado = sinDinero([{ precio: 1, a: 1 }, { precio: 2, a: 2 }]) as Nodo[];
  verificar("un array de objetos se barre entero",
    anidado.length === 2 && !tiene(anidado[0], "precio") && !tiene(anidado[1], "precio") &&
    anidado[1].a === 2);
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) { console.error(`${fallos} fallaron.`); process.exit(1); }
console.log("Filtro de dinero verificado sin errores.");
