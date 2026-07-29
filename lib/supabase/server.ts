import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { applyRememberMe, REMEMBER_ME_COOKIE } from "@/lib/supabase/cookie-persistence";

export async function createClient(options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  // Default true: unchanged behavior for every existing caller. Only the
  // signIn action passes rememberMe explicitly, based on the login form.
  const rememberMe = options?.rememberMe ?? cookieStore.get(REMEMBER_ME_COOKIE)?.value !== "0";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
              cookieStore.set(name, value, applyRememberMe(cookieOptions, rememberMe)),
            );
          } catch {
            // setAll called from a Server Component; safe to ignore
            // when session refresh is handled elsewhere (e.g. proxy/middleware).
          }
        },
      },
    },
  );
}
