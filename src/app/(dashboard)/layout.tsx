import type { ReactNode } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import Header from "@/components/layout/Header";
import AssistenteBubble from "@/components/assistente/AssistenteBubble";
import { getContagemListaEspera } from "@/actions/lista-espera";

export const dynamic = "force-dynamic";

type ProfissionalInfo = {
  id?: string;
  nome?: string;
  logoUrl?: string | null;
  plano?: string;
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
    .select("plano")
    .eq("id", prof.tenant_id as string)
    .maybeSingle();

  return {
    id: (prof.id as string | undefined) ?? undefined,
    nome: (prof.nome as string | undefined) ?? undefined,
    logoUrl: (prof.logo_url as string | null | undefined) ?? null,
    plano: (tenant?.plano as string | undefined) ?? "trial",
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { id: profId, nome: userName, logoUrl, plano } =
    await getProfissionalInfo();
  const contagemRes = await getContagemListaEspera();
  const contagemListaEspera = contagemRes.ok ? contagemRes.data : 0;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar logoUrl={logoUrl} contagemListaEspera={contagemListaEspera} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={userName} />
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 mb-20 lg:mb-0">
          <div className="w-full lg:max-w-[960px] lg:mx-auto">{children}</div>
        </main>
      </div>
      <BottomNav contagemListaEspera={contagemListaEspera} />
      {profId ? (
        <AssistenteBubble
          profissionalId={profId}
          profissionalNome={userName ?? ""}
          plano={plano ?? "trial"}
        />
      ) : null}
    </div>
  );
}
