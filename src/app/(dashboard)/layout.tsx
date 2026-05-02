import type { ReactNode } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import Header from "@/components/layout/Header";

async function getProfissionalNome(): Promise<string | undefined> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profissionais")
    .select("nome")
    .eq("user_id", user.id)
    .maybeSingle();

  return prof?.nome ?? undefined;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const userName = await getProfissionalNome();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={userName} />
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 mb-20 lg:mb-0">
          <div className="w-full lg:max-w-[960px] lg:mx-auto">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
