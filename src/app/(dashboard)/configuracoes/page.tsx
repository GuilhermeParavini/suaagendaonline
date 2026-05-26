import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createClient } from "@/lib/supabase/server";
import { getConfiguracoes } from "@/actions/configuracoes";
import ConfiguracoesClient from "@/components/configuracoes/ConfiguracoesClient";

export const metadata = { title: "Configuracoes" };
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  try {
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
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("ERRO CONFIGURACOES:", error);
    const mensagem =
      error instanceof Error ? error.message : "Erro desconhecido";
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-lg font-semibold text-red-700">
          Erro ao carregar configuracoes
        </h1>
        <p className="text-sm text-red-700">{mensagem}</p>
        <p className="text-xs text-red-600">
          Tente recarregar a pagina. Se o problema persistir, contate o suporte.
        </p>
      </div>
    );
  }
}
