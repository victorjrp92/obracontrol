import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/registro");
  const isProtected =
    req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname.startsWith("/super-admin") ||
    req.nextUrl.pathname.startsWith("/directivo") ||
    req.nextUrl.pathname.startsWith("/contratista") ||
    // Zona del personal de campo. Va en DOS sitios: aquí y en config.matcher
    // de abajo. Si falta en el matcher, el proxy ni siquiera corre para /campo
    // y la zona queda sin sesión obligatoria.
    req.nextUrl.pathname.startsWith("/campo");

  // Redirigir al login si intenta acceder a rutas privadas sin sesión
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirigir al dashboard si ya tiene sesión y va al login/registro
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/super-admin/:path*",
    "/directivo/:path*",
    "/contratista/:path*",
    "/campo/:path*",
    "/login",
    "/registro",
  ],
};
