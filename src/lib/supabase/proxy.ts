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

  // Auth routes (login, cadastro, onboarding) - público
  const isAuthRoute = 
    pathname === '/login' || 
    pathname === '/cadastro' || 
    pathname === '/onboarding';
  
  // Protected routes (dashboard) - requer autenticação
  const isDashboardRoute = 
    pathname === '/' ||
    pathname.startsWith('/agenda') ||
    pathname.startsWith('/pacientes') ||
    pathname.startsWith('/financeiro') ||
    pathname.startsWith('/configuracoes') ||
    pathname.startsWith('/menu');

  // Se usuario NAO esta autenticado
  if (!user) {
    // Redirecionar para login se tentar acessar dashboard
    if (isDashboardRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Permitir acesso a rotas publicas (login, cadastro, onboarding)
    return supabaseResponse;
  }

  // Usuario JA esta autenticado
  if (isAuthRoute) {
    // Nao redirecionar ainda - deixar a pagina de onboarding lidar
    // Se for /login ou /cadastro, redirecionar para /
    if (pathname === '/login' || pathname === '/cadastro') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Se for /onboarding, permitir acesso (a pagina raiz fara o redirecionamento se necessario)
    return supabaseResponse;
  }

  return supabaseResponse;
}
