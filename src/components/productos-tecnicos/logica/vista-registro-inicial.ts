import type { ProductoApi } from "./api-productos-tecnicos";
import type { EspacioListado } from "./arbol-espacios";
import { leerMarca } from "./marca-foto-inicial";

/**
 * De la fila de `productos_tecnicos` a lo que se pinta en la pantalla del
 * registro inicial.
 *
 * Aquí se aplica la MISMA regla que en el acta y por el mismo motivo: una foto
 * cuya marca no se puede leer —sin instante, sin coordenadas, sin constancia de
 * que la imagen lleva el overlay— no es una foto del registro y no se pinta como
 * si lo fuera. La pantalla y el documento tienen que estar de acuerdo en qué
 * cuenta; si la pantalla mostrara doce fotos y el acta emitiera diez, el número
 * que el profesional recuerda no sería el que firma.
 *
 * Módulo puro: sin React, sin red, sin Prisma.
 */

export interface FotoRegistroVista {
  id: string;
  espacioId: string;
  /** Nombre del espacio congelado al capturar; es el que está quemado en la foto. */
  espacio: string;
  /** «Cocina · Apto 501 · Piso 5 · Torre A». */
  ubicacion: string;
  /** ISO 8601 del instante de la captura. */
  capturadaEn: string;
  lat: number;
  lng: number;
  nota: string | null;
  /** URL firmada temporal, o `blob:` de una foto recién tomada. `null` si no hay. */
  url: string | null;
}

export interface EspacioConFotos {
  espacioId: string;
  nombre: string;
  ubicacion: string;
  fotos: FotoRegistroVista[];
}

/**
 * Una fila de `REGISTRO_INICIAL` que NO lleva marca.
 *
 * No debería existir —la única puerta del registro construye la marca en el
 * servidor— pero puede llegar por la ruta genérica de productos técnicos, que
 * acepta el tipo `REGISTRO_INICIAL` con un archivo cualquiera. Y si llega, no
 * puede quedarse invisible: el acta se niega a emitirse mientras haya una foto
 * sin fecha, hora y ubicación, así que una foto invisible y no descartable
 * dejaría la obra sin poder emitir su acta y sin nada en pantalla que explique
 * por qué.
 *
 * Se enseña aparte, con su propio aviso y su botón de descartar. La estrictez se
 * conserva; lo que se añade es la salida.
 */
export interface FotoSinMarca {
  id: string;
  /** Lo que diga la columna `nombre`, que es lo único fiable que trae. */
  nombre: string;
  /** ISO de cuándo se subió. No de cuándo se tomó: eso es justo lo que falta. */
  subidaEl: string;
  url: string | null;
}

/** Las dos mitades de un registro: lo que es del registro y lo que no. */
export interface RegistroSeparado {
  fotos: FotoRegistroVista[];
  sinMarca: FotoSinMarca[];
}

/**
 * Reparte las filas en las dos mitades. Es el único sitio donde se decide qué
 * cuenta como foto del registro, y por eso lo usan la pantalla y —a través de
 * `leerMarca()`— el acta.
 */
export function separarPorMarca(
  productos: readonly ProductoApi[],
  espacios: readonly EspacioListado[],
  urlPorId: ReadonlyMap<string, string | null>,
): RegistroSeparado {
  const fotos: FotoRegistroVista[] = [];
  const sinMarca: FotoSinMarca[] = [];

  for (const producto of productos) {
    const url = urlPorId.get(producto.id) ?? null;
    const vista = aFotoVista(producto, espacios, url);
    if (vista) {
      fotos.push(vista);
    } else {
      sinMarca.push({
        id: producto.id,
        nombre: producto.nombre,
        subidaEl: producto.created_at,
        url,
      });
    }
  }

  return { fotos, sinMarca };
}

/**
 * Convierte una fila en lo que se pinta. `null` si la fila no lleva marca — y
 * ese `null` es la puerta cerrada, no un caso raro: una foto sin fecha, hora y
 * ubicación no entra a esta pantalla ni al documento.
 */
export function aFotoVista(
  producto: ProductoApi,
  espacios: readonly EspacioListado[],
  url: string | null,
): FotoRegistroVista | null {
  const marca = leerMarca(producto.descripcion);
  if (!marca) return null;

  const ubicado = espacios.find((e) => e.espacioId === marca.espacioId);

  return {
    id: producto.id,
    espacioId: marca.espacioId,
    espacio: marca.espacio,
    // La dirección sale del árbol de la obra; el nombre del espacio, de la
    // marca. Si alguien renombró el espacio después de la foto, lo que se lee en
    // la pantalla sigue siendo lo que está impreso dentro de la imagen.
    ubicacion: ubicado ? ubicado.ubicacion.replace(ubicado.nombre, marca.espacio) : marca.espacio,
    capturadaEn: marca.capturadaEn,
    lat: marca.lat,
    lng: marca.lng,
    nota: marca.nota,
    url,
  };
}

/**
 * Agrupa por espacio en el orden del recorrido del inmueble, no en el orden en
 * que se tomaron las fotos. Dentro de cada espacio, de la más antigua a la más
 * reciente: es el orden en que se numeran en el acta, y ver otro aquí obligaría
 * a recontar.
 */
export function agruparPorEspacio(
  fotos: readonly FotoRegistroVista[],
  espacios: readonly EspacioListado[],
): EspacioConFotos[] {
  const porEspacio = new Map<string, FotoRegistroVista[]>();
  for (const foto of fotos) {
    const grupo = porEspacio.get(foto.espacioId);
    if (grupo) grupo.push(foto);
    else porEspacio.set(foto.espacioId, [foto]);
  }

  return [...porEspacio.entries()]
    .map(([espacioId, delEspacio]) => {
      const ubicado = espacios.find((e) => e.espacioId === espacioId);
      return {
        espacioId,
        nombre: delEspacio[0].espacio,
        ubicacion: delEspacio[0].ubicacion,
        orden: ubicado ? ubicado.orden : Number.MAX_SAFE_INTEGER,
        fotos: [...delEspacio].sort(
          (a, b) => Date.parse(a.capturadaEn) - Date.parse(b.capturadaEn) || a.id.localeCompare(b.id),
        ),
      };
    })
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))
    .map(({ espacioId, nombre, ubicacion, fotos: delEspacio }) => ({
      espacioId,
      nombre,
      ubicacion,
      fotos: delEspacio,
    }));
}

/**
 * El número con el que cada foto va a salir en el acta.
 *
 * Se calcula con la misma regla que usa el documento —global, en el orden en que
 * se lee— para que el profesional pueda decir «la foto 3» mirando la pantalla y
 * que sea la foto 3 del PDF. Si las dos numeraciones se separaran, el número
 * dejaría de servir justo para lo que existe.
 */
export function numerarComoEnElActa(
  grupos: readonly EspacioConFotos[],
): ReadonlyMap<string, number> {
  const numeros = new Map<string, number>();
  let n = 0;
  for (const grupo of grupos) {
    for (const foto of grupo.fotos) {
      n += 1;
      numeros.set(foto.id, n);
    }
  }
  return numeros;
}
