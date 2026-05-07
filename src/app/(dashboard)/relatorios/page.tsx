import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRelatorioFaturamento } from "@/actions/relatorios";
import { LazyRelatoriosClient } from "@/lib/dynamic-imports";

export const metadata = { title: "Relatorios" };
export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getRelatorioFaturamento();
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  return (
    <LazyRelatoriosClient
      initialFaturamento={result.data}
      initialPeriodo={result.data.periodo}
    />
  );
}
