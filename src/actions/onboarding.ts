"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export type PassoOnboardingId =
  | "dados_completos"
  | "horarios_configurados"
  | "procedimentos_cadastrados"
  | "logo_cadastrada"
  | "paciente_cadastrado"
  | "agendamento_criado"
  | "link_compartilhado";

export interface PassoOnboarding {
  id: PassoOnboardingId;
  titulo: string;
  url: string;
  /** Identifica se a verificacao depende do localStorage (cliente). */
  verificadoNoCliente?: boolean;
  concluido: boolean;
}

export interface ProgressoOnboarding {
  passos: PassoOnboarding[];
  totalConcluidos: number;
  total: number;
  /** Tenant criado ha N dias inteiros (>= 0). null se nao identificado. */
  tenantCriadoHaDias: number | null;
}

/**
 * Define os passos do checklist de configuracao inicial.
 * O passo "link_compartilhado" e marcado no cliente via localStorage —
 * o servidor nao tem como saber se o profissional ja copiou/enviou o link.
 */
export async function getProgressoOnboarding(): Promise<ProgressoOnboarding> {
  const passosVazios = passosBase().map((p) => ({ ...p, concluido: false }));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      passos: passosVazios,
      totalConcluidos: 0,
      total: passosVazios.length,
      tenantCriadoHaDias: null,
    };
  }

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profissionais")
    .select(
      "id, tenant_id, nome, especialidade, telefone, logo_url, avatar_url",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  if (!prof) {
    return {
      passos: passosVazios,
      totalConcluidos: 0,
      total: passosVazios.length,
      tenantCriadoHaDias: null,
    };
  }

  const profissionalId = prof.id as string;
  const tenantId = prof.tenant_id as string;

  const [
    { count: horariosCount },
    { count: procedimentosCount },
    { count: pacientesCount },
    { count: agendamentosCount },
    { data: tenant },
  ] = await Promise.all([
    admin
      .from("horarios_disponiveis")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profissionalId)
      .eq("ativo", true),
    admin
      .from("procedimentos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("ativo", true),
    admin
      .from("pacientes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("ativo", true),
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    admin.from("tenants").select("created_at").eq("id", tenantId).maybeSingle(),
  ]);

  const dadosCompletos = Boolean(
    (prof.nome as string | null)?.trim() &&
      (prof.especialidade as string | null)?.trim() &&
      (prof.telefone as string | null)?.trim(),
  );
  const horariosOk = (horariosCount ?? 0) > 0;
  const procedimentosOk = (procedimentosCount ?? 0) > 0;
  const logoOk = Boolean(
    (prof.logo_url as string | null) || (prof.avatar_url as string | null),
  );
  const pacienteOk = (pacientesCount ?? 0) > 0;
  const agendamentoOk = (agendamentosCount ?? 0) > 0;

  const checks: Record<PassoOnboardingId, boolean> = {
    dados_completos: dadosCompletos,
    horarios_configurados: horariosOk,
    procedimentos_cadastrados: procedimentosOk,
    logo_cadastrada: logoOk,
    paciente_cadastrado: pacienteOk,
    agendamento_criado: agendamentoOk,
    // Verificado no cliente via localStorage 'link_compartilhado'.
    link_compartilhado: false,
  };

  const passos = passosBase().map<PassoOnboarding>((p) => ({
    ...p,
    concluido: checks[p.id],
  }));

  const totalConcluidos = passos.filter(
    (p) => p.concluido && !p.verificadoNoCliente,
  ).length;

  let tenantCriadoHaDias: number | null = null;
  const createdAt = (tenant?.created_at as string | null) ?? null;
  if (createdAt) {
    const ms = Date.now() - new Date(createdAt).getTime();
    if (Number.isFinite(ms) && ms >= 0) {
      tenantCriadoHaDias = Math.floor(ms / (1000 * 60 * 60 * 24));
    }
  }

  return {
    passos,
    totalConcluidos,
    total: passos.length,
    tenantCriadoHaDias,
  };
}

function passosBase(): Omit<PassoOnboarding, "concluido">[] {
  return [
    {
      id: "dados_completos",
      titulo: "Completar dados pessoais",
      url: "/configuracoes",
    },
    {
      id: "horarios_configurados",
      titulo: "Configurar horarios de atendimento",
      url: "/configuracoes?tab=horarios",
    },
    {
      id: "procedimentos_cadastrados",
      titulo: "Cadastrar procedimentos",
      url: "/configuracoes?tab=procedimentos",
    },
    {
      id: "logo_cadastrada",
      titulo: "Adicionar logo da clinica",
      url: "/configuracoes",
    },
    {
      id: "paciente_cadastrado",
      titulo: "Cadastrar primeiro paciente",
      url: "/pacientes/novo",
    },
    {
      id: "agendamento_criado",
      titulo: "Fazer primeiro agendamento",
      url: "/agenda",
    },
    {
      id: "link_compartilhado",
      titulo: "Compartilhar link de agendamento",
      url: "/configuracoes",
      verificadoNoCliente: true,
    },
  ];
}
