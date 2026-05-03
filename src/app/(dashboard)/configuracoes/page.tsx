import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConfiguracoes } from "@/actions/configuracoes";
import ConfiguracoesClient from "@/components/configuracoes/ConfiguracoesClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getConfiguracoes();
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  return (
    <ConfiguracoesClient
      initialProfissional={result.data.profissional}
      initialTenant={result.data.tenant}
      initialHorarios={result.data.horarios}
      initialProcedimentos={result.data.procedimentos}
    />
  );
}
