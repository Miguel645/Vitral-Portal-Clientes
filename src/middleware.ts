import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type SupabaseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function middleware(request: NextRequest) {
  // Vercel Cron calls this without a session; the route checks CRON_SECRET itself.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims checks the login token's signature right here, without asking Supabase on
  // every click (when the project uses the newer asymmetric "JWT signing keys"; with the
  // older shared secret it asks Supabase, like getUser did). It also refreshes a token
  // about to expire. The data itself stays protected by row level security either way.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isUnsubscribe = request.nextUrl.pathname.startsWith("/u/");
  const isPublic = isLogin || isUnsubscribe;

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // The app icons too, so they show on the login page (signed out).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
