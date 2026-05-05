import type { ReactNode } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import Header from "@/components/layout/Header";
import { getContagemListaEspera } from "@/actions/lista-espera";

export const dynamic = "force-dynamic";

async function getProfissionalInfo(): Promise<{
  nome?: string;
  logoUrl?: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const admin = createAdminClient();
  const { data: prof, error } = await admin
    .from("profissionais")
    .select("nome, logo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[DashboardLayout] Erro ao buscar profissional:", error.message);
    return {};
  }

  return {
    nome: (prof?.nome as string | undefined) ?? undefined,
    logoUrl: (prof?.logo_url as string | null | undefined) ?? null,
  };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { nome: userName, logoUrl } = await getProfissionalInfo();
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
    </div>
  );
}
