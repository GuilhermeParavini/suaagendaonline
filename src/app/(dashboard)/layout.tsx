import type { ReactNode } from "react";
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

  if (error) {
    console.error(
      "[DashboardLayout] Erro ao buscar profissional:",
      error.message,
    );
    return {};
  }
  if (!prof) return {};

  const { data: tenant } = await admin
    .from("tenants")
    .select("plano, modulos_ativos")
    .eq("id", prof.tenant_id as string)
    .maybeSingle();

  const plano = (tenant?.plano as string | undefined) ?? "trial";
  return {
    id: (prof.id as string | undefined) ?? undefined,
    nome: (prof.nome as string | undefined) ?? undefined,
    logoUrl: (prof.logo_url as string | null | undefined) ?? null,
    plano,
    modulos: normalizarModulosAtivos(tenant?.modulos_ativos, plano),
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [
    { id: profId, nome: userName, logoUrl, plano, modulos },
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
      <Sidebar
        logoUrl={logoUrl}
        contagemListaEspera={contagemListaEspera}
        modulos={modulos}
        tenantCriadoHaDias={progresso.tenantCriadoHaDias}
        onboardingCompleto={onboardingCompleto}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={userName} />
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 mb-20 lg:mb-0">
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
      <TourGuiado />
      <ServiceWorkerRegister />
      <BannerOffline />
    </div>
  );
}
