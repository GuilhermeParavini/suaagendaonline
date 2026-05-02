import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import AgendaClient from "@/components/agenda/AgendaClient";
import type { AgendamentoDia } from "@/actions/agendamentos";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profissionais")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const hoje = new Date();
  const dataIso = format(hoje, "yyyy-MM-dd");

  let agendamentos: AgendamentoDia[] = [];

  if (prof) {
    const inicio = `${dataIso}T00:00:00.000Z`;
    const fim = `${dataIso}T23:59:59.999Z`;

    const { data: rows } = await admin
      .from("agendamentos")
      .select(
        "id, data_hora, duracao_min, status, pacientes(id, nome), procedimentos(id, nome)",
      )
      .eq("profissional_id", prof.id)
      .gte("data_hora", inicio)
      .lte("data_hora", fim)
      .order("data_hora", { ascending: true });

    agendamentos = (rows ?? []).map((r) => {
      const paciente = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
      const procedimento = Array.isArray(r.procedimentos)
        ? r.procedimentos[0]
        : r.procedimentos;
      return {
        id: r.id as string,
        data_hora: r.data_hora as string,
        duracao_min: r.duracao_min as number,
        status: r.status as AgendamentoDia["status"],
        paciente: paciente
          ? { id: paciente.id as string, nome: paciente.nome as string }
          : null,
        procedimento: procedimento
          ? { id: procedimento.id as string, nome: procedimento.nome as string }
          : null,
      };
    });
  }

  return (
    <AgendaClient initialDate={dataIso} initialAgendamentos={agendamentos} />
  );
}
