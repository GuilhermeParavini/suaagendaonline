import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getListaEspera } from "@/actions/lista-espera";
import { listarProfissionaisAtivosTenant } from "@/actions/equipe";
import ListaEsperaClient from "@/components/lista-espera/ListaEsperaClient";

export const metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

export default async function ListaEsperaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [listaRes, profsRes] = await Promise.all([
    getListaEspera({ status: "aguardando" }),
    listarProfissionaisAtivosTenant(),
  ]);

  if (!listaRes.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {listaRes.error}
      </div>
    );
  }

  return (
    <ListaEsperaClient
      initialItens={listaRes.data}
      profissionais={profsRes.ok ? profsRes.data : []}
    />
  );
}
