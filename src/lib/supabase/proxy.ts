import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rotas 100% publicas que NAO devem nem passar por getUser/redirect:
  // - Callback/confirm de auth (OAuth, magic link, recovery)
  // - Paginas de recuperacao de senha
  // - Fluxos publicos compartilhaveis: cadastro publico de paciente,
  //   pre-consulta, agendamento publico, reagendamento, convite, avaliacao,
  //   recibo publico, anamnese print.
  const isRotaPublica =
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/confirm') ||
    pathname === '/esqueci-senha' ||
    pathname === '/redefinir-senha' ||
    pathname.startsWith('/cadastro-paciente/') ||
    pathname.startsWith('/pre-consulta/') ||
    pathname.startsWith('/agendar/') ||
    pathname.startsWith('/reagendar/') ||
    pathname.startsWith('/convite/') ||
    pathname.startsWith('/avaliacao/') ||
    pathname.startsWith('/recibo/');
  if (isRotaPublica) {
    return NextResponse.next({ request });
  }

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

  // Rotas de autenticacao (login/cadastro/onboarding) — publicas mas com
  // tratamento especifico para logados.
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/cadastro' ||
    pathname === '/signup' ||
    pathname === '/onboarding';

  // Rotas protegidas (dashboard). Match exato OU prefixo com '/' para nao
  // colidir com rotas publicas como /agendar/[slug].
  // OBS: '/' (landing publica) NAO entra aqui — a page.tsx da landing faz
  // o redirect para /inicio quando o usuario esta logado.
  const isDashboardRoute =
    pathname === '/inicio' || pathname.startsWith('/inicio/') ||
    pathname === '/dashboard' || pathname.startsWith('/dashboard/') ||
    pathname === '/agenda' || pathname.startsWith('/agenda/') ||
    pathname === '/pacientes' || pathname.startsWith('/pacientes/') ||
    pathname === '/financeiro' || pathname.startsWith('/financeiro/') ||
    pathname === '/configuracoes' || pathname.startsWith('/configuracoes/') ||
    pathname === '/menu' || pathname.startsWith('/menu/');

  // Usuario NAO autenticado
  if (!user) {
    if (isDashboardRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Landing ('/'), login, cadastro, onboarding e demais rotas: liberar.
    return supabaseResponse;
  }

  // Usuario AUTENTICADO
  if (isAuthRoute) {
    // login/cadastro/signup -> redirecionar pra tela inicial do app
    if (
      pathname === '/login' ||
      pathname === '/cadastro' ||
      pathname === '/signup'
    ) {
      return NextResponse.redirect(new URL('/inicio', request.url));
    }
    // /onboarding fica livre — a propria pagina decide.
    return supabaseResponse;
  }

  // Em '/' (landing) ou em qualquer outra rota nao listada, deixar passar.
  // A landing tem redirect proprio no page.tsx para logados.
  return supabaseResponse;
}
