import { notFound, redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import FichaPaciente, {
  type AgendamentoHistorico,
  type PacienteDetalhe,
  type ResponsavelDetalhe,
} from "@/components/pacientes/FichaPaciente";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PacienteDetalhePage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

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
  if (!prof) notFound();

  const { data: pacienteRow, error: pacienteErr } = await admin
    .from("pacientes")
    .select(
      "id, nome, cpf, data_nascimento, genero, telefone, email, endereco, cidade, estado, cep, convenio, menor_idade",
    )
    .eq("id", id)
    .eq("tenant_id", prof.tenant_id)
    .eq("ativo", true)
    .maybeSingle();
  if (pacienteErr || !pacienteRow) notFound();

  const paciente: PacienteDetalhe = {
    id: pacienteRow.id as string,
    nome: pacienteRow.nome as string,
    cpf: pacienteRow.cpf as string,
    data_nascimento: pacienteRow.data_nascimento as string,
    genero: pacienteRow.genero as PacienteDetalhe["genero"],
    telefone: (pacienteRow.telefone as string) ?? "",
    email: (pacienteRow.email as string | null) ?? null,
    endereco: (pacienteRow.endereco as string | null) ?? null,
    cidade: (pacienteRow.cidade as string | null) ?? null,
    estado: (pacienteRow.estado as string | null) ?? null,
    cep: (pacienteRow.cep as string | null) ?? null,
    convenio: (pacienteRow.convenio as string | null) ?? null,
    menor_idade: Boolean(pacienteRow.menor_idade),
  };

  let responsavel: ResponsavelDetalhe | null = null;
  if (paciente.menor_idade) {
    const { data: respRow } = await admin
      .from("responsaveis")
      .select("nome, cpf, telefone, email, grau_parentesco")
      .eq("paciente_id", paciente.id)
      .maybeSingle();
    if (respRow) {
      responsavel = {
        nome: respRow.nome as string,
        cpf: respRow.cpf as string,
        telefone: respRow.telefone as string,
        email: (respRow.email as string | null) ?? null,
        grau_parentesco: respRow.grau_parentesco as ResponsavelDetalhe["grau_parentesco"],
      };
    }
  }

  const { data: agRows } = await admin
    .from("agendamentos")
    .select(
      "id, data_hora, status, procedimentos(nome), profissionais(nome)",
    )
    .eq("paciente_id", paciente.id)
    .eq("tenant_id", prof.tenant_id)
    .order("data_hora", { ascending: false });

  const historico: AgendamentoHistorico[] = (agRows ?? []).map((r) => {
    const proc = Array.isArray(r.procedimentos) ? r.procedimentos[0] : r.procedimentos;
    const profRow = Array.isArray(r.profissionais)
      ? r.profissionais[0]
      : r.profissionais;
    return {
      id: r.id as string,
      data_hora: r.data_hora as string,
      status: r.status as AgendamentoHistorico["status"],
      procedimento_nome: proc?.nome ? (proc.nome as string) : null,
      profissional_nome: profRow?.nome ? (profRow.nome as string) : null,
    };
  });

  return (
    <FichaPaciente
      paciente={paciente}
      responsavel={responsavel}
      historico={historico}
    />
  );
}
