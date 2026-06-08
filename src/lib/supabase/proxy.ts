import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "./admin";

// Verifica se o usuario tem perfil profissional usando o ADMIN client (service
// role, sem RLS). O contexto server-side do proxy nao resolve auth.uid() de
// forma confiavel, entao a checagem via anon+RLS falhava (nao via a linha recem
// criada no onboarding) e derrubava o usuario de volta ao /onboarding mesmo com
// o perfil ja salvo. O service role le a tabela direto, sem depender de RLS.
// Fail-closed: qualquer erro/excecao conta como "sem perfil".
async function temPerfilProfissional(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: perfil, error } = await admin
      .from('profissionais')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error(
        '[proxy] Falha ao verificar perfil profissional — tratando como sem perfil:',
        error.message,
      );
      return false;
    }
    console.log(
      '[proxy] verificacao perfil - userId:',
      userId,
      'temPerfil:',
      !!perfil,
    );
    return !!perfil;
  } catch (e) {
    console.error(
      '[proxy] Excecao ao verificar perfil profissional — tratando como sem perfil:',
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

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
    const res = NextResponse.next({ request });
    // Rotas ligadas a fluxo de sessao nunca devem ser cacheadas (browser/SW).
    if (
      pathname.startsWith('/auth/') ||
      pathname === '/esqueci-senha' ||
      pathname === '/redefinir-senha'
    ) {
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    return res;
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

  // Paginas de auth nunca devem ser cacheadas (browser/SW) — evita servir
  // telas de login/onboarding stale apos deploy ou troca de sessao.
  if (isAuthRoute) {
    supabaseResponse.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate',
    );
  }

  // Rotas protegidas (dashboard). Match exato OU prefixo com '/' para nao
  // colidir com rotas publicas como /agendar/[slug].
  // OBS: '/' (landing publica) NAO entra aqui — a page.tsx da landing faz
  // o redirect para /inicio quando o usuario esta logado.
  // A lista cobre todos os segmentos do grupo (dashboard) — manter em dia
  // ao criar novas rotas protegidas.
  const dashboardSegments = [
    'inicio',
    'dashboard',
    'agenda',
    'pacientes',
    'financeiro',
    'configuracoes',
    'relatorios',
    'relatorio-clinico',
    'estoque',
    'plano-cuidados',
    'planos-tratamento',
    'comissoes',
    'lista-espera',
    'atendimento',
    'atestado',
    'ajuda',
    'menu',
  ];
  const isDashboardRoute = dashboardSegments.some(
    (seg) => pathname === `/${seg}` || pathname.startsWith(`/${seg}/`),
  );

  // Usuario NAO autenticado
  if (!user) {
    if (isDashboardRoute) {
      // Se havia cookie de sessao do Supabase, foi expiracao/refresh falho —
      // sinaliza ?expired=true para o login exibir aviso e limpa os cookies
      // corrompidos para nao ficar em loop de refresh.
      const cookiesSb = request.cookies
        .getAll()
        .filter((c) => c.name.startsWith('sb-'));
      const tinhaSessao = cookiesSb.length > 0;

      const loginUrl = new URL('/login', request.url);
      if (tinhaSessao) loginUrl.searchParams.set('expired', 'true');

      const redirectResponse = NextResponse.redirect(loginUrl);
      cookiesSb.forEach((c) => redirectResponse.cookies.delete(c.name));
      return redirectResponse;
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
    // /onboarding: se o usuario JA tem perfil, nao deve refazer o onboarding —
    // redirecionar para /inicio. Sem perfil, deixar a pagina renderizar.
    if (await temPerfilProfissional(user.id)) {
      return NextResponse.redirect(new URL('/inicio', request.url));
    }
    return supabaseResponse;
  }

  // GATE DE ONBOARDING: usuario logado SEM perfil profissional ainda nao
  // concluiu o cadastro. Em QUALQUER rota protegida do dashboard, forcar
  // /onboarding. A checagem usa o ADMIN client (service role, sem RLS) — ver
  // temPerfilProfissional. Fail-closed: erro/excecao conta como "sem perfil".
  if (isDashboardRoute) {
    const temPerfil = await temPerfilProfissional(user.id);

    if (!temPerfil) {
      const onboardingUrl = new URL('/onboarding', request.url);
      const redirectResponse = NextResponse.redirect(onboardingUrl);
      // Preserva cookies de sessao eventualmente renovados pelo getUser(),
      // senao a sessao recem-refrescada se perde no redirect.
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }

  // Em '/' (landing) ou em qualquer outra rota nao listada, deixar passar.
  // A landing tem redirect proprio no page.tsx para logados.
  return supabaseResponse;
}
