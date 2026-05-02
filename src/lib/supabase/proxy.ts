import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  const pathname = request.nextUrl.pathname;

  // Auth routes (login, cadastro)
  const isAuthRoute = pathname === '/login' || pathname === '/cadastro';
  
  // Protected routes (requires authentication)
  const isProtectedRoute = 
    pathname === '/' ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/pacientes') ||
    pathname.startsWith('/financeiro') ||
    pathname.startsWith('/configuracoes') ||
    pathname.startsWith('/menu');

  // If user is not authenticated and tries to access protected route
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is authenticated and tries to access auth routes
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}
