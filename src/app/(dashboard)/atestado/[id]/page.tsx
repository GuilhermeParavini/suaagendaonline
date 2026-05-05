import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAtestadoData } from "@/actions/documentos";
import AtestadoPrint from "@/components/documentos/AtestadoPrint";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AtestadoPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getAtestadoData(id);
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  return <AtestadoPrint data={result.data} />;
}
