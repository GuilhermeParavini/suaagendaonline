import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import Header from "@/components/layout/Header";
import AssistenteBubble from "@/components/assistente/AssistenteBubble";
import TourGuiado from "@/components/onboarding/TourGuiado";
import ServiceWorkerRegister from "@/components/layout/ServiceWorkerRegister";
import BannerOffline from "@/components/ui/BannerOffline";
import { getContagemListaEspera } from "@/actions/lista-espera";
import { getProgressoOnboarding } from "@/actions/onboarding";
import {
  normalizarModulosAtivos,
  type ModulosAtivos,
} from "@/lib/planos";

export const dynamic = "force-dynamic";

type ProfissionalInfo = {
  id?: string;
  nome?: string;
  logoUrl?: string | null;
  plano?: string;
  modulos?: ModulosAtivos;
  trialExpiraEm?: string | null;
};

async function getProfissionalInfo(): Promise<ProfissionalInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const admin = createAdminClient();
  const { data: prof, error } = await admin
    .from("profissionais")
    .select("id, tenant_id, nome, logo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  // Rede de seguranca: o proxy ja deveria barrar usuarios sem perfil, mas se
  // chegou aqui sem profissional (ou a query falhou), redirecionar para o
  // /onboarding em vez de renderizar o dashboard com "Profissional nao
  // encontrado". Fail-closed: erro tambem cai no onboarding.
  if (error) {
    console.error(
      "Erro ao buscar profissional — redirecionando para /onboarding:",
      error.message,
    );
    redirect("/onboarding");
  }
  if (!prof) redirect("/onboarding");

  const { data: tenant } = await admin
    .from("tenants")
    .select("plano, modulos_ativos, trial_expira_em")
    .eq("id", prof.tenant_id as string)
    .maybeSingle();

  const plano = (tenant?.plano as string | undefined) ?? "trial";
  return {
    id: (prof.id as string | undefined) ?? undefined,
    nome: (prof.nome as string | undefined) ?? undefined,
    logoUrl: (prof.logo_url as string | null | undefined) ?? null,
    plano,
    modulos: normalizarModulosAtivos(tenant?.modulos_ativos, plano),
    trialExpiraEm: (tenant?.trial_expira_em as string | null | undefined) ?? null,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // ============================================================
  // GATE INFALIVEL — executa ANTES de qualquer Promise.all, children ou JSX.
  // Sem usuario -> /login. Sem perfil profissional -> /onboarding.
  // redirect() e chamado direto no corpo do Server Component (nao em helper
  // nem dentro de Promise.all), sem try/catch e sem fallback, para o
  // NEXT_REDIRECT propagar de forma garantida.
  // getUser usa o client COM sessao (cookies); a query de perfil usa o admin
  // client (service role) para NAO depender de RLS.
  // ============================================================
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const adminGate = createAdminClient();
  const { data: profissionalGate } = await adminGate
    .from("profissionais")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Fail-closed: sem perfil OU query com erro -> onboarding.
  if (!profissionalGate) redirect("/onboarding");
  // A partir daqui o perfil profissional esta garantido.
  // ============================================================

  const [
    { id: profId, nome: userName, logoUrl, plano, modulos, trialExpiraEm },
    contagemRes,
    progresso,
  ] = await Promise.all([
    getProfissionalInfo(),
    getContagemListaEspera(),
    getProgressoOnboarding(),
  ]);
  const contagemListaEspera = contagemRes.ok ? contagemRes.data : 0;
  const onboardingCompleto = progresso.totalConcluidos >= progresso.total;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <a href="#main-content" className="sao-skip-link no-touch-min">
        Pular para o conteudo
      </a>
      <Sidebar
        logoUrl={logoUrl}
        contagemListaEspera={contagemListaEspera}
        modulos={modulos}
        tenantCriadoHaDias={progresso.tenantCriadoHaDias}
        onboardingCompleto={onboardingCompleto}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          userName={userName}
          plano={plano}
          trialExpiraEm={trialExpiraEm}
        />
        <main
          id="main-content"
          className="flex-1 px-4 py-4 lg:px-6 lg:py-6 mb-20 lg:mb-0"
        >
          <div className="w-full lg:max-w-[960px] lg:mx-auto">{children}</div>
        </main>
      </div>
      <BottomNav
        contagemListaEspera={contagemListaEspera}
        modulos={modulos}
        tenantCriadoHaDias={progresso.tenantCriadoHaDias}
        onboardingCompleto={onboardingCompleto}
      />
      {profId ? (
        <AssistenteBubble
          profissionalId={profId}
          profissionalNome={userName ?? ""}
          plano={plano ?? "trial"}
        />
      ) : null}
      {/* Tour guiado so faz sentido com perfil profissional ja criado.
          Sem perfil, o layout redireciona para /onboarding antes daqui — esta
          condicao e uma protecao extra para nunca exibir o tour sobre o erro. */}
      {profId ? <TourGuiado /> : null}
      <ServiceWorkerRegister />
      <BannerOffline />
    </div>
  );
}
