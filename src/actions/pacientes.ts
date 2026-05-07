'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cleanCPF, cleanCEP, cleanPhone } from '@/lib/masks';
import { validateCPF, isValidBirthDate, isMinor } from '@/lib/validators';
import {
  normalizarMedida,
  normalizarOrigem,
  type OrigemPaciente,
} from '@/lib/paciente-origem';
import { enviarNotificacaoEmail } from '@/lib/notificacoes';
import {
  emailConfirmacaoCadastro,
  montarLinkAgendamento,
} from '@/lib/email-templates';
import { getTenantEmailSignature } from '@/lib/tenant-email-signature';
import { registrarAcesso } from '@/lib/log-acesso';
import { registrarConsentimento } from '@/lib/consentimento';

export type StatusTratamento = 'ativo' | 'alta' | 'inativo';

export type ContatoPreferencial = 'whatsapp' | 'telefone' | 'email' | 'sms';

const contatoPreferencialSchema = z
  .enum(['whatsapp', 'telefone', 'email', 'sms'])
  .default('whatsapp');

function parseContatoPreferencial(
  raw: unknown,
): ContatoPreferencial {
  const r = contatoPreferencialSchema.safeParse(raw);
  return r.success ? r.data : 'whatsapp';
}

export type PacienteListItem = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  convenio: string | null;
  menor_idade: boolean;
  ultima_consulta: string | null;
  status_tratamento: StatusTratamento;
  contato_preferencial: ContatoPreferencial;
};

type GetPacientesResult =
  | { ok: true; pacientes: PacienteListItem[] }
  | { ok: false; error: string };

type GetConveniosResult =
  | { ok: true; data: string[] }
  | { ok: false; error: string };

function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

async function buildList(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  profissionalId: string,
  query: string | null,
  convenioFiltro: string | null,
  statusFiltro: StatusTratamento | 'todos' | null,
): Promise<PacienteListItem[]> {
  let pacientesQuery = admin
    .from('pacientes')
    .select(
      'id, nome, telefone, email, convenio, menor_idade, status_tratamento, contato_preferencial',
    )
    .eq('tenant_id', tenantId)
    .eq('ativo', true);

  if (
    statusFiltro &&
    statusFiltro !== 'todos' &&
    ['ativo', 'alta', 'inativo'].includes(statusFiltro)
  ) {
    pacientesQuery = pacientesQuery.eq('status_tratamento', statusFiltro);
  }

  const q = query?.trim() ?? '';
  if (q.length > 0) {
    const digits = cleanDigits(q);
    // PostgREST .or() trata virgula e parenteses como separadores;
    // sanitiza o termo de nome para nao quebrar a query.
    const safeNome = q.replace(/[,()*]/g, ' ').trim();
    if (digits.length >= 3) {
      // LGPD: busca por nome OU telefone (sem CPF), ignorando mascara.
      pacientesQuery = pacientesQuery.or(
        `nome.ilike.*${safeNome}*,telefone.ilike.*${digits}*`,
      );
    } else {
      pacientesQuery = pacientesQuery.ilike('nome', `%${safeNome}%`);
    }
  }

  const conv = convenioFiltro?.trim() ?? '';
  if (conv.length > 0) {
    pacientesQuery = pacientesQuery.eq('convenio', conv);
  }

  const { data: pacientes, error } = await pacientesQuery.order('nome', {
    ascending: true,
  });
  if (error) throw new Error(error.message);

  const lista = pacientes ?? [];
  if (lista.length === 0) return [];

  const ids = lista.map((p) => p.id as string);

  const { data: ultimas, error: ultErr } = await admin
    .from('agendamentos')
    .select('paciente_id, data_hora')
    .eq('profissional_id', profissionalId)
    .eq('status', 'concluido')
    .in('paciente_id', ids)
    .order('data_hora', { ascending: false });
  if (ultErr) throw new Error(ultErr.message);

  const ultimaPorPaciente = new Map<string, string>();
  for (const row of ultimas ?? []) {
    const pid = row.paciente_id as string;
    if (!ultimaPorPaciente.has(pid)) {
      ultimaPorPaciente.set(pid, row.data_hora as string);
    }
  }

  return lista.map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    telefone: (p.telefone as string) ?? '',
    email: (p.email as string | null) ?? null,
    convenio: (p.convenio as string | null) ?? null,
    menor_idade: Boolean(p.menor_idade),
    ultima_consulta: ultimaPorPaciente.get(p.id as string) ?? null,
    status_tratamento:
      ((p.status_tratamento as StatusTratamento | null) ?? 'ativo'),
    contato_preferencial: parseContatoPreferencial(p.contato_preferencial),
  }));
}

export async function getPacientes(
  query?: string,
  convenio?: string,
  status?: StatusTratamento | 'todos',
): Promise<GetPacientesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();

  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  try {
    const pacientes = await buildList(
      admin,
      prof.tenant_id as string,
      prof.id as string,
      query ?? null,
      convenio ?? null,
      status ?? null,
    );
    return { ok: true, pacientes };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getConveniosExistentes(): Promise<GetConveniosResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();

  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data, error } = await admin
    .from('pacientes')
    .select('convenio')
    .eq('tenant_id', prof.tenant_id as string)
    .not('convenio', 'is', null)
    .neq('convenio', '');
  if (error) return { ok: false, error: error.message };

  const set = new Set<string>();
  for (const row of data ?? []) {
    const c = ((row.convenio as string | null) ?? '').trim();
    if (c) set.add(c);
  }
  const lista = Array.from(set).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
  return { ok: true, data: lista };
}

export type Genero = 'masculino' | 'feminino' | 'prefiro_nao_informar';
export type GrauParentesco = 'mae' | 'pai' | 'avo' | 'tio' | 'outro';

export type NovoPacienteInput = {
  nome: string;
  cpf: string;
  data_nascimento: string;
  genero: Genero;
  telefone: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  convenio?: string;
  altura?: number | null;
  peso?: number | null;
  origem?: OrigemPaciente | null;
  origem_detalhe?: string | null;
  contato_preferencial?: ContatoPreferencial;
  responsavel?: {
    nome: string;
    cpf: string;
    telefone: string;
    email?: string;
    grau_parentesco: GrauParentesco;
  };
};

type CreatePacienteResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const LGPD_TEXT =
  'Termo de consentimento LGPD aceito pelo profissional no cadastro do paciente. ' +
  'Autoriza tratamento de dados pessoais e sensíveis para finalidade clínica e administrativa, ' +
  'conforme Lei 13.709/2018.';

export async function createPaciente(
  input: NovoPacienteInput,
): Promise<CreatePacienteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();

  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 3) return { ok: false, error: 'Nome invalido.' };

  const cpf = cleanCPF(input.cpf ?? '');
  if (!validateCPF(cpf)) return { ok: false, error: 'CPF invalido.' };

  if (!isValidBirthDate(input.data_nascimento)) {
    return { ok: false, error: 'Data de nascimento invalida.' };
  }

  if (!['masculino', 'feminino', 'prefiro_nao_informar'].includes(input.genero)) {
    return { ok: false, error: 'Genero invalido.' };
  }

  const telefone = cleanPhone(input.telefone ?? '');
  if (telefone.length !== 10 && telefone.length !== 11) {
    return { ok: false, error: 'Telefone invalido.' };
  }

  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'E-mail invalido.' };
  }

  const cepDigits = input.cep ? cleanCEP(input.cep) : '';
  if (cepDigits && cepDigits.length !== 8) {
    return { ok: false, error: 'CEP invalido.' };
  }

  const menor = isMinor(input.data_nascimento);
  if (menor && !input.responsavel) {
    return { ok: false, error: 'Responsavel obrigatorio para menor de idade.' };
  }

  let respPayload: {
    nome: string;
    cpf: string;
    telefone: string;
    email: string | null;
    grau_parentesco: GrauParentesco;
  } | null = null;

  if (menor && input.responsavel) {
    const respNome = input.responsavel.nome?.trim() ?? '';
    if (respNome.length < 3) {
      return { ok: false, error: 'Nome do responsavel invalido.' };
    }
    const respCpf = cleanCPF(input.responsavel.cpf ?? '');
    if (!validateCPF(respCpf)) {
      return { ok: false, error: 'CPF do responsavel invalido.' };
    }
    const respTel = cleanPhone(input.responsavel.telefone ?? '');
    if (respTel.length !== 10 && respTel.length !== 11) {
      return { ok: false, error: 'Telefone do responsavel invalido.' };
    }
    const respEmail = input.responsavel.email?.trim() || null;
    if (respEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respEmail)) {
      return { ok: false, error: 'E-mail do responsavel invalido.' };
    }
    if (
      !['mae', 'pai', 'avo', 'tio', 'outro'].includes(
        input.responsavel.grau_parentesco,
      )
    ) {
      return { ok: false, error: 'Grau de parentesco invalido.' };
    }
    respPayload = {
      nome: respNome,
      cpf: respCpf,
      telefone: respTel,
      email: respEmail,
      grau_parentesco: input.responsavel.grau_parentesco,
    };
  }

  // Verificar duplicidade de CPF no tenant
  const { data: existing, error: dupError } = await admin
    .from('pacientes')
    .select('id')
    .eq('tenant_id', prof.tenant_id)
    .eq('cpf', cpf)
    .maybeSingle();
  if (dupError) return { ok: false, error: dupError.message };
  if (existing) {
    return { ok: false, error: 'CPF ja cadastrado neste tenant.' };
  }

  const altura = normalizarMedida(input.altura, 30, 250);
  const peso = normalizarMedida(input.peso, 1, 500);
  const { origem, origem_detalhe } = normalizarOrigem(
    input.origem,
    input.origem_detalhe,
  );

  const contatoPreferencial = parseContatoPreferencial(
    input.contato_preferencial,
  );

  // Inserir paciente
  const { data: pacienteRow, error: insertError } = await admin
    .from('pacientes')
    .insert({
      tenant_id: prof.tenant_id,
      nome,
      cpf,
      data_nascimento: input.data_nascimento,
      genero: input.genero,
      telefone,
      email: email,
      endereco: input.endereco?.trim() || null,
      cidade: input.cidade?.trim() || null,
      estado: input.estado?.trim() || null,
      cep: cepDigits || null,
      convenio: input.convenio?.trim() || null,
      altura,
      peso,
      origem,
      origem_detalhe,
      contato_preferencial: contatoPreferencial,
      ativo: true,
    })
    .select('id')
    .single();
  if (insertError || !pacienteRow) {
    return { ok: false, error: insertError?.message ?? 'Falha ao salvar paciente.' };
  }

  const pacienteId = pacienteRow.id as string;

  // Inserir responsavel se menor
  let responsavelId: string | null = null;
  if (respPayload) {
    const { data: respRow, error: respError } = await admin
      .from('responsaveis')
      .insert({
        paciente_id: pacienteId,
        nome: respPayload.nome,
        cpf: respPayload.cpf,
        telefone: respPayload.telefone,
        email: respPayload.email,
        grau_parentesco: respPayload.grau_parentesco,
      })
      .select('id')
      .single();
    if (respError || !respRow) {
      // Rollback paciente para evitar orfao
      await admin.from('pacientes').delete().eq('id', pacienteId);
      return {
        ok: false,
        error: respError?.message ?? 'Falha ao salvar responsavel.',
      };
    }
    responsavelId = respRow.id as string;
  }

  // Registrar consentimento LGPD
  const { error: consError } = await admin.from('consentimentos').insert({
    paciente_id: pacienteId,
    responsavel_id: responsavelId,
    tipo: menor ? 'lgpd_menor' : 'lgpd_geral',
    aceite: true,
    texto_aceito: LGPD_TEXT,
  });
  if (consError) {
    // Rollback paciente (cascata deleta responsavel) para manter consistencia
    await admin.from('pacientes').delete().eq('id', pacienteId);
    return { ok: false, error: `Falha ao registrar consentimento: ${consError.message}` };
  }

  return { ok: true, id: pacienteId };
}

export type AtualizarPacienteInput = {
  nome: string;
  data_nascimento: string;
  genero: Genero;
  telefone: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  convenio?: string;
  observacoes?: string;
  altura?: number | null;
  peso?: number | null;
  origem?: OrigemPaciente | null;
  origem_detalhe?: string | null;
  contato_preferencial?: ContatoPreferencial;
  responsavel?: {
    nome: string;
    cpf: string;
    telefone: string;
    email?: string;
    grau_parentesco: GrauParentesco;
  } | null;
};

type AtualizarPacienteResult = { ok: true } | { ok: false; error: string };

export async function atualizarPaciente(
  id: string,
  input: AtualizarPacienteInput,
): Promise<AtualizarPacienteResult> {
  if (!id) return { ok: false, error: 'Paciente invalido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();

  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: pacienteRow, error: pacErr } = await admin
    .from('pacientes')
    .select('id, tenant_id, menor_idade')
    .eq('id', id)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pacienteRow) return { ok: false, error: 'Paciente nao encontrado.' };
  if (pacienteRow.tenant_id !== prof.tenant_id) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 3) return { ok: false, error: 'Nome invalido.' };

  if (!isValidBirthDate(input.data_nascimento)) {
    return { ok: false, error: 'Data de nascimento invalida.' };
  }

  if (!['masculino', 'feminino', 'prefiro_nao_informar'].includes(input.genero)) {
    return { ok: false, error: 'Genero invalido.' };
  }

  const telefone = cleanPhone(input.telefone ?? '');
  if (telefone.length !== 10 && telefone.length !== 11) {
    return { ok: false, error: 'Telefone invalido.' };
  }

  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'E-mail invalido.' };
  }

  const cepDigits = input.cep ? cleanCEP(input.cep) : '';
  if (cepDigits && cepDigits.length !== 8) {
    return { ok: false, error: 'CEP invalido.' };
  }

  const menor = isMinor(input.data_nascimento);
  if (menor && !input.responsavel) {
    return { ok: false, error: 'Responsavel obrigatorio para menor de idade.' };
  }

  let respPayload: {
    nome: string;
    cpf: string;
    telefone: string;
    email: string | null;
    grau_parentesco: GrauParentesco;
  } | null = null;

  if (menor && input.responsavel) {
    const r = input.responsavel;
    const respNome = r.nome?.trim() ?? '';
    if (respNome.length < 3) {
      return { ok: false, error: 'Nome do responsavel invalido.' };
    }
    const respCpf = cleanCPF(r.cpf ?? '');
    if (!validateCPF(respCpf)) {
      return { ok: false, error: 'CPF do responsavel invalido.' };
    }
    const respTel = cleanPhone(r.telefone ?? '');
    if (respTel.length !== 10 && respTel.length !== 11) {
      return { ok: false, error: 'Telefone do responsavel invalido.' };
    }
    const respEmail = r.email?.trim() || null;
    if (respEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respEmail)) {
      return { ok: false, error: 'E-mail do responsavel invalido.' };
    }
    if (
      !['mae', 'pai', 'avo', 'tio', 'outro'].includes(r.grau_parentesco)
    ) {
      return { ok: false, error: 'Grau de parentesco invalido.' };
    }
    respPayload = {
      nome: respNome,
      cpf: respCpf,
      telefone: respTel,
      email: respEmail,
      grau_parentesco: r.grau_parentesco,
    };
  }

  const altura = normalizarMedida(input.altura, 30, 250);
  const peso = normalizarMedida(input.peso, 1, 500);
  const { origem, origem_detalhe } = normalizarOrigem(
    input.origem,
    input.origem_detalhe,
  );

  const contatoPreferencial = parseContatoPreferencial(
    input.contato_preferencial,
  );

  const { error: updError } = await admin
    .from('pacientes')
    .update({
      nome,
      data_nascimento: input.data_nascimento,
      genero: input.genero,
      telefone,
      email: email,
      endereco: input.endereco?.trim() || null,
      cidade: input.cidade?.trim() || null,
      estado: input.estado?.trim() || null,
      cep: cepDigits || null,
      convenio: input.convenio?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      altura,
      peso,
      origem,
      origem_detalhe,
      contato_preferencial: contatoPreferencial,
    })
    .eq('id', id);
  if (updError) return { ok: false, error: updError.message };

  if (menor && respPayload) {
    const { data: existingResp, error: existRespErr } = await admin
      .from('responsaveis')
      .select('id')
      .eq('paciente_id', id)
      .maybeSingle();
    if (existRespErr) return { ok: false, error: existRespErr.message };

    if (existingResp) {
      const { error: respErr } = await admin
        .from('responsaveis')
        .update({
          nome: respPayload.nome,
          cpf: respPayload.cpf,
          telefone: respPayload.telefone,
          email: respPayload.email,
          grau_parentesco: respPayload.grau_parentesco,
        })
        .eq('id', existingResp.id);
      if (respErr) return { ok: false, error: respErr.message };
    } else {
      const { error: respErr } = await admin.from('responsaveis').insert({
        paciente_id: id,
        nome: respPayload.nome,
        cpf: respPayload.cpf,
        telefone: respPayload.telefone,
        email: respPayload.email,
        grau_parentesco: respPayload.grau_parentesco,
      });
      if (respErr) return { ok: false, error: respErr.message };
    }
  } else if (!menor) {
    // Paciente passou a ser maior — remove responsavel(eis) existente(s)
    const { error: delErr } = await admin
      .from('responsaveis')
      .delete()
      .eq('paciente_id', id);
    if (delErr) return { ok: false, error: delErr.message };
  }

  // LGPD: registra a edicao do paciente.
  void registrarAcesso({
    acao: 'editar_paciente',
    recurso: 'paciente',
    recursoId: id,
  });

  revalidatePath(`/pacientes/${id}`);
  revalidatePath('/pacientes');
  return { ok: true };
}

export type CadastroAvulsoInput = {
  slug: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  genero: Genero;
  telefone: string;
  email?: string;
  convenio?: string;
  origem?: OrigemPaciente | null;
  origem_detalhe?: string | null;
  contato_preferencial?: ContatoPreferencial;
  aceiteLgpd: boolean;
  responsavel?: {
    nome: string;
    cpf: string;
    telefone: string;
    email?: string;
    grau_parentesco: GrauParentesco;
  };
};

type CadastroAvulsoResult =
  | { ok: true; pacienteId: string; profissionalNome: string }
  | { ok: false; error: string; jaCadastrado?: boolean; profissionalNome?: string };

const LGPD_TEXT_PUBLICO =
  'Termo de consentimento LGPD aceito pelo paciente em cadastro publico. ' +
  'Autoriza tratamento de dados pessoais e sensiveis para finalidade clinica e administrativa, ' +
  'conforme Lei 13.709/2018.';

export async function cadastrarPacienteAvulso(
  input: CadastroAvulsoInput,
): Promise<CadastroAvulsoResult> {
  if (!input.aceiteLgpd) {
    return { ok: false, error: 'E necessario aceitar o termo LGPD.' };
  }

  const slug = input.slug?.trim().toLowerCase() ?? '';
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: 'Link invalido.' };
  }

  const admin = createAdminClient();

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: 'Profissional nao encontrado.' };

  const tenantId = tenant.id as string;

  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('nome, especialidade, logo_url')
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  const profissionalNome = (prof?.nome as string | null) ?? 'profissional';
  const profissionalEspecialidade =
    (prof?.especialidade as string | null) ?? null;
  const profissionalLogoUrl = (prof?.logo_url as string | null) ?? null;

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 3) return { ok: false, error: 'Nome invalido.' };

  const cpf = cleanCPF(input.cpf ?? '');
  if (cpf.length !== 11) {
    return { ok: false, error: 'CPF deve ter 11 digitos.' };
  }

  // Verifica duplicidade ANTES da validacao do digito:
  // se o CPF ja existe, queremos sempre exibir "Voce ja esta cadastrado",
  // mesmo que o numero digitado nao passe na validacao do digito verificador.
  const { data: existing, error: dupErr } = await admin
    .from('pacientes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('cpf', cpf)
    .maybeSingle();
  if (dupErr) return { ok: false, error: dupErr.message };
  if (existing) {
    return {
      ok: false,
      error: `Voce ja esta cadastrado com ${profissionalNome}.`,
      jaCadastrado: true,
      profissionalNome,
    };
  }

  if (!validateCPF(cpf)) return { ok: false, error: 'CPF invalido.' };

  if (!isValidBirthDate(input.data_nascimento)) {
    return { ok: false, error: 'Data de nascimento invalida.' };
  }

  if (!['masculino', 'feminino', 'prefiro_nao_informar'].includes(input.genero)) {
    return { ok: false, error: 'Genero invalido.' };
  }

  const telefone = cleanPhone(input.telefone ?? '');
  if (telefone.length !== 10 && telefone.length !== 11) {
    return { ok: false, error: 'Telefone invalido.' };
  }

  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'E-mail invalido.' };
  }

  const menor = isMinor(input.data_nascimento);
  if (menor && !input.responsavel) {
    return { ok: false, error: 'Responsavel obrigatorio para menor de idade.' };
  }

  let respPayload:
    | {
        nome: string;
        cpf: string;
        telefone: string;
        email: string | null;
        grau_parentesco: GrauParentesco;
      }
    | null = null;

  if (menor && input.responsavel) {
    const r = input.responsavel;
    const respNome = r.nome?.trim() ?? '';
    if (respNome.length < 3) {
      return { ok: false, error: 'Nome do responsavel invalido.' };
    }
    const respCpf = cleanCPF(r.cpf ?? '');
    if (!validateCPF(respCpf)) {
      return { ok: false, error: 'CPF do responsavel invalido.' };
    }
    const respTel = cleanPhone(r.telefone ?? '');
    if (respTel.length !== 10 && respTel.length !== 11) {
      return { ok: false, error: 'Telefone do responsavel invalido.' };
    }
    const respEmail = r.email?.trim() || null;
    if (respEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respEmail)) {
      return { ok: false, error: 'E-mail do responsavel invalido.' };
    }
    if (!['mae', 'pai', 'avo', 'tio', 'outro'].includes(r.grau_parentesco)) {
      return { ok: false, error: 'Grau de parentesco invalido.' };
    }
    respPayload = {
      nome: respNome,
      cpf: respCpf,
      telefone: respTel,
      email: respEmail,
      grau_parentesco: r.grau_parentesco,
    };
  }

  const { origem: origemAvulso, origem_detalhe: origemDetalheAvulso } =
    normalizarOrigem(input.origem, input.origem_detalhe);

  const contatoPreferencial = parseContatoPreferencial(
    input.contato_preferencial,
  );

  const { data: pacRow, error: insErr } = await admin
    .from('pacientes')
    .insert({
      tenant_id: tenantId,
      nome,
      cpf,
      data_nascimento: input.data_nascimento,
      genero: input.genero,
      telefone,
      email: email,
      convenio: input.convenio?.trim() || null,
      origem: origemAvulso,
      origem_detalhe: origemDetalheAvulso,
      contato_preferencial: contatoPreferencial,
      ativo: true,
    })
    .select('id')
    .single();
  if (insErr || !pacRow) {
    return { ok: false, error: insErr?.message ?? 'Falha ao salvar paciente.' };
  }
  const pacienteId = pacRow.id as string;

  let responsavelId: string | null = null;
  if (respPayload) {
    const { data: respRow, error: respErr } = await admin
      .from('responsaveis')
      .insert({
        paciente_id: pacienteId,
        nome: respPayload.nome,
        cpf: respPayload.cpf,
        telefone: respPayload.telefone,
        email: respPayload.email,
        grau_parentesco: respPayload.grau_parentesco,
      })
      .select('id')
      .single();
    if (respErr || !respRow) {
      await admin.from('pacientes').delete().eq('id', pacienteId);
      return {
        ok: false,
        error: respErr?.message ?? 'Falha ao salvar responsavel.',
      };
    }
    responsavelId = respRow.id as string;
  }

  const consResult = await registrarConsentimento({
    pacienteId,
    responsavelId,
    tipo: 'lgpd_cadastro',
    textoTermo: LGPD_TEXT_PUBLICO,
  });
  if (!consResult.ok) {
    const { error: legacyErr } = await admin.from('consentimentos').insert({
      paciente_id: pacienteId,
      responsavel_id: responsavelId,
      tipo: menor ? 'lgpd_menor' : 'lgpd_geral',
      aceite: true,
      texto_aceito: LGPD_TEXT_PUBLICO,
    });
    if (legacyErr) {
      await admin.from('pacientes').delete().eq('id', pacienteId);
      return {
        ok: false,
        error: `Falha ao registrar consentimento: ${consResult.error}`,
      };
    }
  }

  // Envia confirmacao ao paciente (se tiver email)
  try {
    if (email) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
      const linkAgendamento = montarLinkAgendamento(baseUrl, slug);

      const assinatura = await getTenantEmailSignature(tenantId);
      const tpl = emailConfirmacaoCadastro({
        pacienteNome: nome,
        profissionalNome,
        profissionalEspecialidade,
        linkAgendamento,
        logoUrl: profissionalLogoUrl,
        assinatura,
      });

      await enviarNotificacaoEmail({
        tenantId,
        agendamentoId: null,
        tipo: 'boas_vindas',
        destino: email,
        assunto: tpl.assunto,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error('[cadastro-avulso] erro ao confirmar para paciente:', e);
  }

  return { ok: true, pacienteId, profissionalNome };
}

type ExcluirPacienteResult = { ok: true } | { ok: false; error: string };

export async function excluirPaciente(
  id: string,
): Promise<ExcluirPacienteResult> {
  if (!id) return { ok: false, error: 'Paciente invalido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();

  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: pacienteRow, error: pacErr } = await admin
    .from('pacientes')
    .select('id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pacienteRow) return { ok: false, error: 'Paciente nao encontrado.' };
  if (pacienteRow.tenant_id !== prof.tenant_id) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const agora = new Date().toISOString();
  const { count, error: countErr } = await admin
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('paciente_id', id)
    .gte('data_hora', agora)
    .in('status', ['agendado', 'confirmado', 'em_atendimento']);
  if (countErr) return { ok: false, error: countErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        'Paciente possui agendamentos futuros. Cancele os agendamentos antes de excluir.',
    };
  }

  const { error: updErr } = await admin
    .from('pacientes')
    .update({ ativo: false })
    .eq('id', id);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/pacientes');
  return { ok: true };
}

// ============================================================
// Alta / reativacao
// ============================================================

export type DarAltaResult =
  | { ok: true; agendamentosFuturos: number }
  | { ok: false; error: string };

export async function darAlta(
  pacienteId: string,
  motivo: string,
): Promise<DarAltaResult> {
  if (!pacienteId) return { ok: false, error: 'Paciente invalido.' };
  const motivoLimpo = (motivo ?? '').trim();
  if (motivoLimpo.length < 3) {
    return { ok: false, error: 'Motivo da alta obrigatorio.' };
  }
  if (motivoLimpo.length > 1000) {
    return { ok: false, error: 'Motivo acima de 1000 caracteres.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  const role = (prof.role as string) ?? 'profissional';
  if (role !== 'admin' && role !== 'profissional') {
    return { ok: false, error: 'Sem permissao para dar alta.' };
  }

  const { data: pac, error: pacErr } = await admin
    .from('pacientes')
    .select('id, tenant_id')
    .eq('id', pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac) return { ok: false, error: 'Paciente nao encontrado.' };
  if (pac.tenant_id !== prof.tenant_id) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const agora = new Date().toISOString();
  const { count } = await admin
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('paciente_id', pacienteId)
    .gte('data_hora', agora)
    .in('status', ['agendado', 'confirmado', 'em_atendimento']);
  const agendamentosFuturos = count ?? 0;

  const { error: updErr } = await admin
    .from('pacientes')
    .update({
      status_tratamento: 'alta',
      data_alta: agora,
      motivo_alta: motivoLimpo,
    })
    .eq('id', pacienteId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath('/pacientes');
  return { ok: true, agendamentosFuturos };
}

export async function reativarPaciente(
  pacienteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pacienteId) return { ok: false, error: 'Paciente invalido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error: profError } = await admin
    .from('profissionais')
    .select('id, tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profError) return { ok: false, error: profError.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  const role = (prof.role as string) ?? 'profissional';
  if (role !== 'admin' && role !== 'profissional') {
    return { ok: false, error: 'Sem permissao para reativar.' };
  }

  const { data: pac, error: pacErr } = await admin
    .from('pacientes')
    .select('id, tenant_id')
    .eq('id', pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac) return { ok: false, error: 'Paciente nao encontrado.' };
  if (pac.tenant_id !== prof.tenant_id) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { error: updErr } = await admin
    .from('pacientes')
    .update({
      status_tratamento: 'ativo',
      data_alta: null,
      motivo_alta: null,
    })
    .eq('id', pacienteId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath('/pacientes');
  return { ok: true };
}
