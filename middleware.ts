import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/myflows",
  "/stores",
  "/tags",
  "/customers",
  "/inventory",
];
const AUTH_PATH = "/auth";
const DEFAULT_PROTECTED_REDIRECT = "/myflows";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Build a response we can mutate (to refresh cookies)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create a Supabase server client that reads/writes cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session if expired — important for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthPage =
    pathname === AUTH_PATH || pathname.startsWith(`${AUTH_PATH}/`);

  // ── Unauthenticated user hitting a protected route → redirect to /auth ──
  if (isProtected && !session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = AUTH_PATH;
    // Preserve the original destination so we can redirect back after login
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Authenticated user hitting /auth → redirect to default protected page ──
  if (isAuthPage && session) {
    const next = searchParams.get("next");
    const destination =
      next && PROTECTED_PATHS.some((p) => next.startsWith(p))
        ? next
        : DEFAULT_PROTECTED_REDIRECT;
    const destUrl = request.nextUrl.clone();
    destUrl.pathname = destination;
    destUrl.search = "";
    return NextResponse.redirect(destUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico / favicon.png
     * - /f/* (public form pages)
     * - /api/* (API routes)
     * - /public assets
     */
    "/((?!_next/static|_next/image|favicon|public|api|f/).*)",
  ],
};
