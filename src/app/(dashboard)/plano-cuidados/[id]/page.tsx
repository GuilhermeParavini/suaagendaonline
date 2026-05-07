import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvolucaoDocumento } from "@/actions/documentos";
import { LazyPlanoCuidadosPrint } from "@/lib/dynamic-imports";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanoCuidadosPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getEvolucaoDocumento(id);
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }
  if (!result.data.evolucao.plano_cuidados) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Esta evolucao nao possui plano de cuidados preenchido.
      </div>
    );
  }

  return <LazyPlanoCuidadosPrint data={result.data} />;
}
