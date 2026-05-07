import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvolucaoDocumento } from "@/actions/documentos";
import { LazyRelatorioClinicoPrint } from "@/lib/dynamic-imports";
import { registrarAcesso } from "@/lib/log-acesso";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RelatorioClinicoPage({ params }: PageProps) {
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

  void registrarAcesso({
    acao: "exportar_pdf",
    recurso: "relatorio_clinico",
    recursoId: id,
  });

  return <LazyRelatorioClinicoPrint data={result.data} />;
}
