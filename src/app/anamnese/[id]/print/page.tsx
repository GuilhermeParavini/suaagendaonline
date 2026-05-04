import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarDadosAnamneseImpressao } from "@/lib/anamnese-pdf";
import AnamneseImpressao from "@/components/anamnese/AnamneseImpressao";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ auto?: string }>;
}

export default async function AnamnesePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await carregarDadosAnamneseImpressao(id);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  const sp = searchParams ? await searchParams : {};
  const autoPrint = sp?.auto === "1";

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <AnamneseImpressao data={result.data} autoPrint={autoPrint} />
    </div>
  );
}
