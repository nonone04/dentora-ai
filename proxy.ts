import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyRememberMe, REMEMBER_ME_COOKIE } from "@/lib/supabase/cookie-persistence";

const PROTECTED_PREFIXES = ["/clinic", "/account"];
const AUTH_ROUTES = ["/login"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // @supabase/ssr always writes cookies with its own 400-day maxAge (see
  // lib/supabase/cookie-persistence.ts) -- this is where every request's
  // token-refresh cookie write gets re-persisted, so Remember Me has to be
  // enforced here too, not just in lib/supabase/server.ts's setAll.
  const rememberMe = request.cookies.get(REMEMBER_ME_COOKIE)?.value !== "0";

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, applyRememberMe(options, rememberMe)),
          );
        },
      },
    },
  );

  // getClaims() verifies the JWT against Supabase and refreshes it if needed.
  // Do not swap this for getSession(), which only reads the (possibly stale) cookie.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = !!data?.claims;

  const path = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    path.startsWith(prefix),
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => path.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"],
};
