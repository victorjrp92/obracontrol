import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  // Expose pathname to server components via request header for role-based routing.
  // IMPORTANT: delete any inbound x-pathname first — clients could forge it to bypass
  // server-side role gating (e.g. CONTRATISTA spoofing /dashboard/mis-tareas).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-pathname");
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
          response = NextResponse.next({ request: { headers: requestHeaders } });
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
    req.nextUrl.pathname.startsWith("/contratista");

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
    "/login",
    "/registro",
  ],
};
