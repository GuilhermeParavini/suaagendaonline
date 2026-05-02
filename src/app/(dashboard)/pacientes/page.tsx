import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import ListaPacientes from "@/components/pacientes/ListaPacientes";
import type { PacienteListItem } from "@/actions/pacientes";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profissionais")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let initialPacientes: PacienteListItem[] = [];

  if (prof) {
    const { data: pacientes } = await admin
      .from("pacientes")
      .select("id, nome, telefone, cpf, menor_idade")
      .eq("tenant_id", prof.tenant_id)
      .eq("ativo", true)
      .order("nome", { ascending: true });

    const lista = pacientes ?? [];

    let ultimaPorPaciente = new Map<string, string>();
    if (lista.length > 0) {
      const ids = lista.map((p) => p.id as string);
      const { data: ultimas } = await admin
        .from("agendamentos")
        .select("paciente_id, data_hora")
        .eq("profissional_id", prof.id)
        .eq("status", "concluido")
        .in("paciente_id", ids)
        .order("data_hora", { ascending: false });

      ultimaPorPaciente = new Map<string, string>();
      for (const row of ultimas ?? []) {
        const pid = row.paciente_id as string;
        if (!ultimaPorPaciente.has(pid)) {
          ultimaPorPaciente.set(pid, row.data_hora as string);
        }
      }
    }

    initialPacientes = lista.map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
      telefone: (p.telefone as string) ?? "",
      cpf: (p.cpf as string) ?? "",
      menor_idade: Boolean(p.menor_idade),
      ultima_consulta: ultimaPorPaciente.get(p.id as string) ?? null,
    }));
  }

  return <ListaPacientes initialPacientes={initialPacientes} />;
}
