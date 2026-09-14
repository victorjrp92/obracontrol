/**
 * Viste la cuenta demo para que no delate que es una demo.
 *
 * Toca SOLO dato, nunca codigo ni esquema, y SOLO lo que no pertenece a una
 * persona real: los tres usuarios de Karen Cortes y el de Jennifer llevan
 * correos autenticos y se dejan intactos a proposito — renombrarlos dejaria un
 * nombre inventado junto a un gmail de verdad, que es peor que no tocarlos.
 *
 * Es idempotente: correrlo dos veces deja lo mismo.
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const EMAIL_ADMIN = "admin.general@obracontrol.local";

/** Digito de verificacion del NIT, algoritmo de la DIAN. */
function digitoVerificacion(nit: string): number {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const d = nit.replace(/\D/g, "").split("").reverse();
  const suma = d.reduce((a, c, i) => a + Number(c) * pesos[i], 0);
  const r = suma % 11;
  return r < 2 ? r : 11 - r;
}

const NIT_BASE = "901487226";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const admin = await prisma.usuario.findFirst({
    where: { email: EMAIL_ADMIN },
    include: { constructora: true },
  });
  if (!admin) throw new Error(`no existe ${EMAIL_ADMIN}`);
  const cid = admin.constructora_id;

  const nit = `${NIT_BASE}-${digitoVerificacion(NIT_BASE)}`;

  // --- La empresa -------------------------------------------------------
  // `nombre` es el campo mas visible del producto: sale en el subtitulo de
  // TODAS las pantallas del dashboard, en los cuatro PDF y en el correo de
  // invitacion. Hoy contiene literalmente la palabra "Demo".
  await prisma.constructora.update({
    where: { id: cid },
    data: {
      nombre: "Constructora Altamonte S.A.S.",
      nit,
      direccion: "Av. 6N # 23-45, Oficina 702, Centenario",
      ciudad: "Cali",
      telefono: "+57 602 485 7700",
      sitio_web: "https://www.altamonte.com.co",
      descripcion:
        "Constructora vallecaucana especializada en vivienda multifamiliar y obra civil. " +
        "18 años de trayectoria y más de 1.200 unidades entregadas en Cali y el sur del Valle.",
    },
  });

  // --- El administrador -------------------------------------------------
  // Las iniciales se conservan a proposito: el menu lateral las pinta en un
  // circulo y "AG" ya estaba en pantalla.
  await prisma.usuario.update({
    where: { id: admin.id },
    data: { nombre: "Andrés Felipe Gutiérrez", telefono: "+57 318 640 2215" },
  });

  // --- Fuera de la vista las obras que hunden la demo --------------------
  // ARCHIVADO y no borrado: `getProyectosConProgreso` filtra por ACTIVO, asi
  // que desaparecen de la lista sin perder un solo dato y se recuperan
  // cambiando una palabra.
  const aArchivar = ["rosa2", "Proyecto Demo Cali"];
  const arch = await prisma.proyecto.updateMany({
    where: { constructora_id: cid, nombre: { in: aArchivar }, estado: "ACTIVO" },
    data: { estado: "ARCHIVADO" },
  });

  // --- El cliente real que no puede salir en pantalla --------------------
  // "Jaramillo Mora" es una constructora de Cali de verdad, y el producto se
  // le va a ensenar a otra constructora.
  const clientes = await prisma.cliente.findMany({
    where: { constructora_id: cid },
    select: { id: true, nombre: true },
  });
  let renombrados = 0;
  for (const c of clientes) {
    if (!/jaramillo/i.test(c.nombre)) continue;
    await prisma.cliente.update({
      where: { id: c.id },
      data: {
        nombre: "Inversiones Pacífico S.A.S.",
        nit: "900654321-8",
        contacto: "María Fernanda Salazar",
        telefono: "+57 604 372 1180",
        email: "contacto@inversionespacifico.com.co",
      },
    });
    renombrados++;
  }

  // --- La obra que si se ensena ----------------------------------------
  // Es la unica de las tres sin codigo de obra, justo la que se va a abrir.
  const rosas = await prisma.proyecto.findFirst({
    where: { constructora_id: cid, nombre: "Rosas Cali" },
    select: { id: true, numero_registro: true },
  });
  if (rosas && !rosas.numero_registro) {
    await prisma.proyecto.update({
      where: { id: rosas.id },
      data: { numero_registro: "RC-2026-001" },
    });
  }

  // --- El obrero --------------------------------------------------------
  const obreros = await prisma.obrero.updateMany({
    where: { constructora_id: cid, nombre: { contains: "(demo)" } },
    data: { nombre: "Diego Muñoz" },
  });

  console.log(`empresa      : Constructora Altamonte S.A.S.  ·  NIT ${nit}`);
  console.log(`administrador: Andrés Felipe Gutiérrez  (iniciales AG, como antes)`);
  console.log(`archivadas   : ${arch.count} obra(s) de ${aArchivar.length}`);
  console.log(`clientes     : ${renombrados} renombrado(s)`);
  console.log(`obreros      : ${obreros.count} sin "(demo)"`);

  await prisma.$disconnect();
  await pool.end();
}

main();
