'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';

export type EvolucaoDocumentoData = {
  evolucao: {
    id: string;
    texto: string | null;
    receita: string | null;
    diagnostico: string | null;
    plano_cuidados: string | null;
    created_at: string;
  };
  agendamento: {
    id: string;
    data_hora: string;
    duracao_min: number;
    status: string;
  } | null;
  paciente: {
    id: string;
    nome: string;
    data_nascimento: string | null;
    genero: 'masculino' | 'feminino' | 'prefiro_nao_informar';
    telefone: string | null;
    email: string | null;
  };
  procedimento: {
    nome: string;
    duracao_min: number;
  } | null;
  profissional: {
    nome: string;
    especialidade: string;
    registro_profissional: string | null;
    email: string;
    telefone: string | null;
    assinatura_tipo: 'fonte' | 'imagem' | null;
    assinatura_fonte: string | null;
    assinatura_url: string | null;
    logo_url: string | null;
  };
  tenant: {
    nome_empresa: string;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
  };
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function obterContexto(): Promise<
  | { ok: true; tenantId: string; profissionalId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: data.tenant_id as string,
    profissionalId: data.id as string,
  };
}

export async function getEvolucaoDocumento(
  evolucaoId: string,
): Promise<Result<EvolucaoDocumentoData>> {
  if (!evolucaoId) return { ok: false, error: 'Evolucao invalida.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: ev, error: evErr } = await admin
    .from('evolucoes')
    .select(
      'id, tenant_id, paciente_id, profissional_id, agendamento_id, texto, receita, diagnostico, plano_cuidados, created_at',
    )
    .eq('id', evolucaoId)
    .maybeSingle();
  if (evErr) return { ok: false, error: evErr.message };
  if (!ev) return { ok: false, error: 'Evolucao nao encontrada.' };
  if (ev.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const [{ data: pac }, { data: prof }, { data: tenant }] = await Promise.all([
    admin
      .from('pacientes')
      .select('id, nome, data_nascimento, genero, telefone, email')
      .eq('id', ev.paciente_id as string)
      .maybeSingle(),
    admin
      .from('profissionais')
      .select(
        'nome, especialidade, registro_profissional, email, telefone, assinatura_tipo, assinatura_fonte, assinatura_url, logo_url',
      )
      .eq('id', ev.profissional_id as string)
      .maybeSingle(),
    admin
      .from('tenants')
      .select('nome_empresa, endereco, cidade, estado')
      .eq('id', ev.tenant_id as string)
      .maybeSingle(),
  ]);

  if (!pac) return { ok: false, error: 'Paciente nao encontrado.' };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  if (!tenant) return { ok: false, error: 'Clinica nao encontrada.' };

  let agendamento: EvolucaoDocumentoData['agendamento'] = null;
  let procedimento: EvolucaoDocumentoData['procedimento'] = null;
  if (ev.agendamento_id) {
    const { data: ag } = await admin
      .from('agendamentos')
      .select(
        'id, data_hora, duracao_min, status, procedimentos(nome, duracao_min)',
      )
      .eq('id', ev.agendamento_id as string)
      .maybeSingle();
    if (ag) {
      agendamento = {
        id: ag.id as string,
        data_hora: ag.data_hora as string,
        duracao_min: (ag.duracao_min as number) ?? 0,
        status: (ag.status as string) ?? 'agendado',
      };
      const procRaw = Array.isArray(ag.procedimentos)
        ? ag.procedimentos[0]
        : ag.procedimentos;
      if (procRaw) {
        procedimento = {
          nome: (procRaw.nome as string) ?? '',
          duracao_min: (procRaw.duracao_min as number) ?? 0,
        };
      }
    }
  }

  return {
    ok: true,
    data: {
      evolucao: {
        id: ev.id as string,
        texto: (ev.texto as string | null) ?? null,
        receita: (ev.receita as string | null) ?? null,
        diagnostico: (ev.diagnostico as string | null) ?? null,
        plano_cuidados: (ev.plano_cuidados as string | null) ?? null,
        created_at: ev.created_at as string,
      },
      agendamento,
      paciente: {
        id: pac.id as string,
        nome: pac.nome as string,
        data_nascimento: (pac.data_nascimento as string | null) ?? null,
        genero:
          (pac.genero as EvolucaoDocumentoData['paciente']['genero']) ??
          'prefiro_nao_informar',
        telefone: (pac.telefone as string | null) ?? null,
        email: (pac.email as string | null) ?? null,
      },
      procedimento,
      profissional: {
        nome: prof.nome as string,
        especialidade: (prof.especialidade as string) ?? '',
        registro_profissional:
          (prof.registro_profissional as string | null) ?? null,
        email: prof.email as string,
        telefone: (prof.telefone as string | null) ?? null,
        assinatura_tipo:
          (prof.assinatura_tipo as 'fonte' | 'imagem' | null) ?? null,
        assinatura_fonte: (prof.assinatura_fonte as string | null) ?? null,
        assinatura_url: (prof.assinatura_url as string | null) ?? null,
        logo_url: (prof.logo_url as string | null) ?? null,
      },
      tenant: {
        nome_empresa: tenant.nome_empresa as string,
        endereco: (tenant.endereco as string | null) ?? null,
        cidade: (tenant.cidade as string | null) ?? null,
        estado: (tenant.estado as string | null) ?? null,
      },
    },
  };
}

export type AtestadoData = {
  agendamento: {
    id: string;
    data_hora: string;
    duracao_min: number;
    status: string;
  };
  paciente: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
  };
  procedimento: {
    nome: string;
    duracao_min: number;
  } | null;
  profissional: EvolucaoDocumentoData['profissional'];
  tenant: EvolucaoDocumentoData['tenant'];
};

export async function getAtestadoData(
  agendamentoId: string,
): Promise<Result<AtestadoData>> {
  if (!agendamentoId) return { ok: false, error: 'Agendamento invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: ag, error: agErr } = await admin
    .from('agendamentos')
    .select(
      'id, tenant_id, profissional_id, paciente_id, data_hora, duracao_min, status, procedimentos(nome, duracao_min)',
    )
    .eq('id', agendamentoId)
    .maybeSingle();
  if (agErr) return { ok: false, error: agErr.message };
  if (!ag) return { ok: false, error: 'Agendamento nao encontrado.' };
  if (ag.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  if (ag.status !== 'concluido') {
    return {
      ok: false,
      error: 'Atestado disponivel apenas para consultas concluidas.',
    };
  }

  const [{ data: pac }, { data: prof }, { data: tenant }] = await Promise.all([
    admin
      .from('pacientes')
      .select('id, nome, email, telefone')
      .eq('id', ag.paciente_id as string)
      .maybeSingle(),
    admin
      .from('profissionais')
      .select(
        'nome, especialidade, registro_profissional, email, telefone, assinatura_tipo, assinatura_fonte, assinatura_url, logo_url',
      )
      .eq('id', ag.profissional_id as string)
      .maybeSingle(),
    admin
      .from('tenants')
      .select('nome_empresa, endereco, cidade, estado')
      .eq('id', ag.tenant_id as string)
      .maybeSingle(),
  ]);

  if (!pac) return { ok: false, error: 'Paciente nao encontrado.' };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  if (!tenant) return { ok: false, error: 'Clinica nao encontrada.' };

  const procRaw = Array.isArray(ag.procedimentos)
    ? ag.procedimentos[0]
    : ag.procedimentos;
  const procedimento = procRaw
    ? {
        nome: (procRaw.nome as string) ?? '',
        duracao_min: (procRaw.duracao_min as number) ?? 0,
      }
    : null;

  return {
    ok: true,
    data: {
      agendamento: {
        id: ag.id as string,
        data_hora: ag.data_hora as string,
        duracao_min: (ag.duracao_min as number) ?? 0,
        status: ag.status as string,
      },
      paciente: {
        id: pac.id as string,
        nome: pac.nome as string,
        email: (pac.email as string | null) ?? null,
        telefone: (pac.telefone as string | null) ?? null,
      },
      procedimento,
      profissional: {
        nome: prof.nome as string,
        especialidade: (prof.especialidade as string) ?? '',
        registro_profissional:
          (prof.registro_profissional as string | null) ?? null,
        email: prof.email as string,
        telefone: (prof.telefone as string | null) ?? null,
        assinatura_tipo:
          (prof.assinatura_tipo as 'fonte' | 'imagem' | null) ?? null,
        assinatura_fonte: (prof.assinatura_fonte as string | null) ?? null,
        assinatura_url: (prof.assinatura_url as string | null) ?? null,
        logo_url: (prof.logo_url as string | null) ?? null,
      },
      tenant: {
        nome_empresa: tenant.nome_empresa as string,
        endereco: (tenant.endereco as string | null) ?? null,
        cidade: (tenant.cidade as string | null) ?? null,
        estado: (tenant.estado as string | null) ?? null,
      },
    },
  };
}
