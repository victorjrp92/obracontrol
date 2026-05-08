import { NextResponse } from "next/server";
import {
  getDashboardStats,
  getProyectosConProgreso,
  getTareasRecientes,
  getTopContratistas,
  getUsuarioActual,
} from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";

export async function GET() {
  const results: Record<string, string> = {};

  try {
    const usuario = await getUsuarioActual();
    if (!usuario?.constructora_id) {
      return NextResponse.json({ error: "No user/constructora" });
    }
    results.user = "OK";

    const cid = usuario.constructora_id;
    const accessible = await getAccessibleProjectIds(
      usuario.id,
      cid,
      usuario.rol_ref.nivel_acceso,
    );
    results.accessible = "OK";

    try {
      await getDashboardStats(cid, accessible);
      results.stats = "OK";
    } catch (e: unknown) {
      results.stats = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }

    try {
      await getProyectosConProgreso(cid, accessible);
      results.proyectos = "OK";
    } catch (e: unknown) {
      results.proyectos = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }

    try {
      await getTareasRecientes(cid, 8, usuario.id, usuario.rol_ref.nivel_acceso, accessible);
      results.tareas = "OK";
    } catch (e: unknown) {
      results.tareas = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }

    try {
      await getTopContratistas(cid, 3, accessible);
      results.contratistas = "OK";
    } catch (e: unknown) {
      results.contratistas = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json(results);
  } catch (e: unknown) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
      results,
    });
  }
}
