import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { CampoTemplate, CampoTipo } from "@/actions/anamnese";
import AtendimentoClient, {
  type AtendimentoContexto,
} from "@/components/atendimento/AtendimentoClient";
import { registrarAcesso } from "@/lib/log-acesso";

function normalizarCampos(raw: unknown): CampoTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const c = (item ?? {}) as Record<string, unknown>;
    const tipo = (c.tipo as CampoTipo) ?? "texto_livre";
    const campo: CampoTemplate = {
      id: (c.id as string) ?? String(idx),
      label: (c.label as string) ?? "",
      tipo,
      obrigatorio: Boolean(c.obrigatorio),
      ordem: typeof c.ordem === "number" ? c.ordem : idx + 1,
    };
    if (tipo === "selecao_multipla" && Array.isArray(c.opcoes)) {
      campo.opcoes = (c.opcoes as unknown[]).map((o) => String(o));
    }
    if (tipo === "escala_numerica") {
      if (typeof c.min === "number") campo.min = c.min;
      if (typeof c.max === "number") campo.max = c.max;
    }
    return campo;
  });
}

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AtendimentoPage({ params }: PageProps) {
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

  const { data: ag, error: agErr } = await admin
    .from("agendamentos")
    .select(
      "id, data_hora, duracao_min, status, paciente_id, profissional_id, tenant_id, pacientes(id, nome, data_nascimento, genero), procedimentos(id, nome)",
    )
    .eq("id", id)
    .maybeSingle();
  if (agErr || !ag) notFound();
  if (ag.tenant_id !== prof.tenant_id) notFound();

  // LGPD: registra acesso a evolucao clinica.
  void registrarAcesso({
    acao: "visualizar_evolucao",
    recurso: "agendamento",
    recursoId: id,
  });

  const paciente = Array.isArray(ag.pacientes) ? ag.pacientes[0] : ag.pacientes;
  const procedimento = Array.isArray(ag.procedimentos)
    ? ag.procedimentos[0]
    : ag.procedimentos;
  if (!paciente) notFound();

  // Ultima consulta concluida (excluindo a atual)
  const { data: ultimaConcl } = await admin
    .from("agendamentos")
    .select("data_hora")
    .eq("paciente_id", paciente.id)
    .eq("tenant_id", prof.tenant_id)
    .eq("status", "concluido")
    .neq("id", id)
    .order("data_hora", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Total de consultas concluidas
  const { count: totalConcl } = await admin
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("paciente_id", paciente.id)
    .eq("tenant_id", prof.tenant_id)
    .eq("status", "concluido")
    .neq("id", id);

  // Anamnese mais recente
  const { data: anamRow } = await admin
    .from("anamneses")
    .select("id, dados, created_at, templates_anamnese(id, nome, campos)")
    .eq("paciente_id", paciente.id)
    .eq("tenant_id", prof.tenant_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Ultimas 5 evolucoes (excluindo agendamento atual)
  const { data: evRows } = await admin
    .from("evolucoes")
    .select("id, texto, transcricao, created_at, agendamento_id")
    .eq("paciente_id", paciente.id)
    .eq("tenant_id", prof.tenant_id)
    .neq("agendamento_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const ctx: AtendimentoContexto = {
    agendamento: {
      id: ag.id as string,
      data_hora: ag.data_hora as string,
      duracao_min: ag.duracao_min as number,
      status: ag.status as AtendimentoContexto["agendamento"]["status"],
      procedimento_id: procedimento?.id
        ? (procedimento.id as string)
        : null,
      procedimento_nome: procedimento?.nome
        ? (procedimento.nome as string)
        : null,
    },
    paciente: {
      id: paciente.id as string,
      nome: paciente.nome as string,
      data_nascimento: paciente.data_nascimento as string,
      genero: paciente.genero as AtendimentoContexto["paciente"]["genero"],
    },
    isRetorno: (totalConcl ?? 0) > 0,
    ultimaConsulta: (ultimaConcl?.data_hora as string | null) ?? null,
    anamnese: anamRow
      ? (() => {
          const tplRaw = Array.isArray(anamRow.templates_anamnese)
            ? anamRow.templates_anamnese[0]
            : anamRow.templates_anamnese;
          return {
            id: anamRow.id as string,
            created_at: anamRow.created_at as string,
            template_nome: (tplRaw?.nome as string | null) ?? null,
            template_campos: normalizarCampos(tplRaw?.campos),
            dados: (anamRow.dados as Record<string, unknown>) ?? {},
          };
        })()
      : null,
    evolucoesAnteriores: (evRows ?? []).map((r) => ({
      id: r.id as string,
      created_at: r.created_at as string,
      texto: (r.texto as string | null) ?? null,
      transcricao: (r.transcricao as string | null) ?? null,
    })),
  };

  return <AtendimentoClient contexto={ctx} />;
}
