// ---------------------------------------------------------------------------
// Verificación de `src/lib/metraje.ts`: la regla de exceso de m² por tipo de
// unidad que comparten la interfaz del wizard y las dos rutas de API.
//
// Lo que este módulo puede romper sin que se note es la asimetría de la
// regla: sumar MENOS que el total es normal (muros, circulaciones, clósets
// sin listar) y no debe bloquear nada; sumar MÁS es imposible en la
// realidad y debe bloquear siempre. Si esa asimetría se invierte o se
// vuelve simétrica, el wizard empieza a rechazar tipos correctos o a dejar
// pasar tipos inflados sin que ningún test lo note.
//
// Con CONTROL POSITIVO en cada bloque que lo permite: no basta afirmar que
// un caso da bien, hay que construir el caso donde el error SÍ saldría y
// comprobar que la comprobación lo distingue.
// ---------------------------------------------------------------------------

import {
  excesoMetraje,
  excesosMetraje,
  formatearM2,
  mensajeExceso,
  sumaEspacios,
  type TipoMetraje,
} from "@/lib/metraje";

let total = 0;
let fallos = 0;

function verificar(descripcion: string, condicion: boolean) {
  total++;
  if (condicion) console.log(`  OK   ${descripcion}`);
  else {
    fallos++;
    console.error(`  FAIL ${descripcion}`);
  }
}

/** Tipo con lo justo; el resto se completa con valores neutros. */
function tipo(p: Partial<TipoMetraje> & { nombre: string }): TipoMetraje {
  return {
    espacios: [],
    ...p,
  };
}

console.log("Metraje por tipo de unidad - verificacion\n");

// ---------------------------------------------------------------------------
console.log("1. Sumar MENOS que el total no es exceso (es lo normal: muros y circulaciones)");
{
  const t = tipo({
    nombre: "Tipo A",
    espacios: ["Cocina", "Baño", "Alcoba"],
    metraje_total: 48,
    metrajes_espacios: { Cocina: 7, Baño: 4, Alcoba: 12 }, // suma 23, muy por debajo
  });
  verificar(`suma 23 sobre total 48: no es exceso`, excesoMetraje(t) === null);
}

// ---------------------------------------------------------------------------
console.log("\n2. Sumar EXACTO el total no es exceso");
{
  const t = tipo({
    nombre: "Tipo B",
    espacios: ["Cocina", "Alcoba"],
    metraje_total: 20,
    metrajes_espacios: { Cocina: 8, Alcoba: 12 }, // suma exactamente 20
  });
  verificar(`suma 20 sobre total 20 (exacto): no es exceso`, excesoMetraje(t) === null);
}

// ---------------------------------------------------------------------------
console.log("\n3. Sumar MÁS que el total SÍ es exceso, con suma y total correctos");
{
  // Control positivo del caso 2: mismo tipo, un m² de más en un espacio.
  const t = tipo({
    nombre: "Tipo C",
    espacios: ["Cocina", "Alcoba"],
    metraje_total: 20,
    metrajes_espacios: { Cocina: 8, Alcoba: 13 }, // suma 21 > 20
  });
  const e = excesoMetraje(t);
  verificar(`CONTROL: un m² de más SÍ marca exceso`, e !== null);
  verificar(`el exceso trae suma=21 y total=20 correctos`, e?.suma === 21 && e?.total === 20);
  verificar(`el exceso trae el nombre del tipo`, e?.tipo === "Tipo C");
}

// ---------------------------------------------------------------------------
console.log("\n4. Sin metraje_total nunca hay exceso, aunque los espacios sumen mucho");
{
  const t = tipo({
    nombre: "Tipo D",
    espacios: ["Cocina", "Alcoba"],
    metrajes_espacios: { Cocina: 500, Alcoba: 500 }, // suma enorme
    // metraje_total ausente
  });
  verificar(`sin metraje_total no es exceso pese a sumar 1000 m²`, excesoMetraje(t) === null);
}

// ---------------------------------------------------------------------------
console.log("\n5. metraje_total de 0 o negativo se trata como 'sin total'");
{
  const cero = tipo({ nombre: "Tipo E", espacios: ["A"], metraje_total: 0, metrajes_espacios: { A: 5 } });
  const negativo = tipo({ nombre: "Tipo F", espacios: ["A"], metraje_total: -10, metrajes_espacios: { A: 5 } });
  verificar(`metraje_total=0 no es exceso`, excesoMetraje(cero) === null);
  verificar(`metraje_total negativo no es exceso`, excesoMetraje(negativo) === null);
}

// ---------------------------------------------------------------------------
console.log("\n6. Un m² huérfano (espacio borrado) no cuenta para la suma");
{
  const t = tipo({
    nombre: "Tipo G",
    espacios: ["Cocina"], // "Alcoba" ya no está en la lista de espacios
    metraje_total: 10,
    metrajes_espacios: { Cocina: 8, Alcoba: 15 }, // Alcoba quedó huérfano
  });
  verificar(`el huérfano no cuenta: suma es 8, no 23`, sumaEspacios(t) === 8);
  verificar(`con el huérfano fuera, no hay exceso (8 <= 10)`, excesoMetraje(t) === null);

  // Control positivo: el MISMO caso, pero con "Alcoba" presente en espacios,
  // SÍ debe dar exceso — para probar que lo que lo salva es la exclusión.
  const conEspacioPresente = tipo({
    nombre: "Tipo G",
    espacios: ["Cocina", "Alcoba"],
    metraje_total: 10,
    metrajes_espacios: { Cocina: 8, Alcoba: 15 },
  });
  verificar(`CONTROL: con "Alcoba" presente, la suma sí la incluye (23)`, sumaEspacios(conEspacioPresente) === 23);
  verificar(`CONTROL: y entonces SÍ es exceso`, excesoMetraje(conEspacioPresente) !== null);
}

// ---------------------------------------------------------------------------
console.log("\n7. Tolerancia decimal");
{
  // 20.1 + 41.9 en punto flotante da 62.00000000000001, no 62 exacto.
  const t = tipo({
    nombre: "Tipo H",
    espacios: ["A", "B"],
    metraje_total: 62,
    metrajes_espacios: { A: 20.1, B: 41.9 },
  });
  verificar(`20,1 + 41,9 contra 62: el residuo de punto flotante NO cuenta como exceso`, excesoMetraje(t) === null);

  // Control positivo: 62.5 contra 62 sí es un exceso real, no ruido.
  const real = tipo({
    nombre: "Tipo H",
    espacios: ["A"],
    metraje_total: 62,
    metrajes_espacios: { A: 62.5 },
  });
  verificar(`CONTROL: 62,5 contra 62 SÍ es exceso real`, excesoMetraje(real) !== null);
}

// ---------------------------------------------------------------------------
console.log("\n8. Valores no finitos (NaN, Infinity) se ignoran sin reventar");
{
  const t = tipo({
    nombre: "Tipo I",
    espacios: ["A", "B", "C"],
    metraje_total: 10,
    metrajes_espacios: { A: 5, B: NaN, C: Infinity },
  });
  verificar(`NaN e Infinity se ignoran: la suma es solo A=5`, sumaEspacios(t) === 5);
  verificar(`con NaN/Infinity fuera, no hay exceso`, excesoMetraje(t) === null);
}

// ---------------------------------------------------------------------------
console.log("\n9. excesosMetraje sobre una lista: solo los que se pasan");
{
  const cumple = tipo({ nombre: "Cumple", espacios: ["A"], metraje_total: 10, metrajes_espacios: { A: 8 } });
  const sePasa = tipo({ nombre: "Se pasa", espacios: ["A"], metraje_total: 10, metrajes_espacios: { A: 15 } });
  const sinTotal = tipo({ nombre: "Sin total", espacios: ["A"], metrajes_espacios: { A: 999 } });

  const resultado = excesosMetraje([cumple, sePasa, sinTotal]);
  verificar(`de tres tipos, solo el que se pasa aparece`, resultado.length === 1 && resultado[0].tipo === "Se pasa");

  const todosBien = excesosMetraje([cumple, sinTotal]);
  verificar(`si todos cumplen, la lista sale vacía`, todosBien.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n10. formatearM2");
{
  verificar(`63 (entero) -> "63"`, formatearM2(63) === "63");
  verificar(`62.5 -> "62,5" (coma decimal)`, formatearM2(62.5) === "62,5");
  verificar(`CONTROL: 62.5 NO se muestra con punto`, formatearM2(62.5) !== "62.5");
  // Residuo de punto flotante: 20.1 + 41.9 no debe mostrarse como "62,00000000000001".
  verificar(`residuo de punto flotante se limpia (20,1+41,9 -> "62")`, formatearM2(20.1 + 41.9) === "62");
}

// ---------------------------------------------------------------------------
console.log("\n11. mensajeExceso nombra el tipo y los dos números");
{
  const e = { tipo: "Tipo B · 2 alcobas", suma: 63, total: 62 };
  const msg = mensajeExceso(e);
  verificar(`incluye el nombre del tipo`, msg.includes("Tipo B · 2 alcobas"));
  verificar(`incluye la suma formateada`, msg.includes("63"));
  verificar(`incluye el total formateado`, msg.includes("62"));

  const conDecimales = mensajeExceso({ tipo: "X", suma: 62.5, total: 62 });
  verificar(`con decimales usa coma, no punto`, conDecimales.includes("62,5") && !conDecimales.includes("62.5"));
}

console.log(`\n${total - fallos}/${total} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} fallaron.`);
  process.exit(1);
}
console.log("Metraje por tipo de unidad verificado sin errores.");
