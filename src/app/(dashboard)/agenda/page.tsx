import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import AgendaClient from "@/components/agenda/AgendaClient";
import PullToRefresh from "@/components/ui/PullToRefresh";
import {
  getAgendamentosDia,
  type AgendamentoDia,
  type IndisponivelDia,
} from "@/actions/agendamentos";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hoje = new Date();
  const dataIso = format(hoje, "yyyy-MM-dd");

  let agendamentos: AgendamentoDia[] = [];
  let indisponivel: IndisponivelDia | null = null;
  let datasIndisponiveisSemana: string[] = [];

  const result = await getAgendamentosDia(dataIso);
  if (result.ok) {
    agendamentos = result.agendamentos;
    indisponivel = result.indisponivel;
    datasIndisponiveisSemana = result.datasIndisponiveisSemana;
  }

  return (
    <PullToRefresh>
      <AgendaClient
        initialDate={dataIso}
        initialAgendamentos={agendamentos}
        initialIndisponivel={indisponivel}
        initialDatasIndisponiveisSemana={datasIndisponiveisSemana}
      />
    </PullToRefresh>
  );
}
