'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export type CampoTipo =
  | 'texto_livre'
  | 'selecao_multipla'
  | 'sim_nao'
  | 'escala_numerica'
  | 'data'
  | 'upload_foto';

export type CampoTemplate = {
  id: string;
  label: string;
  tipo: CampoTipo;
  obrigatorio: boolean;
  opcoes?: string[];
  min?: number;
  max?: number;
  ordem: number;
};

export type Template = {
  id: string;
  tenant_id: string;
  profissional_id: string;
  nome: string;
  especialidade: string;
  campos: CampoTemplate[];
  padrao: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Anamnese = {
  id: string;
  tenant_id: string;
  paciente_id: string;
  profissional_id: string;
  agendamento_id: string | null;
  template_id: string | null;
  template_nome: string | null;
  template_campos: CampoTemplate[];
  dados: Record<string, unknown>;
  created_at: string;
  updated_at: string;
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

function normalizarCampos(raw: unknown): CampoTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const c = (item ?? {}) as Record<string, unknown>;
    const tipo = (c.tipo as CampoTipo) ?? 'texto_livre';
    const campo: CampoTemplate = {
      id: (c.id as string) ?? crypto.randomUUID(),
      label: (c.label as string) ?? '',
      tipo,
      obrigatorio: Boolean(c.obrigatorio),
      ordem: typeof c.ordem === 'number' ? c.ordem : idx + 1,
    };
    if (tipo === 'selecao_multipla' && Array.isArray(c.opcoes)) {
      campo.opcoes = (c.opcoes as unknown[]).map((o) => String(o));
    }
    if (tipo === 'escala_numerica') {
      if (typeof c.min === 'number') campo.min = c.min;
      if (typeof c.max === 'number') campo.max = c.max;
    }
    return campo;
  });
}

function validarCampos(campos: CampoTemplate[]): string | null {
  if (!Array.isArray(campos)) return 'Campos invalidos.';
  if (campos.length === 0) return 'Adicione ao menos um campo.';
  for (const c of campos) {
    if (!c.label || c.label.trim().length < 2) {
      return 'Todos os campos precisam de um rotulo.';
    }
    if (
      ![
        'texto_livre',
        'selecao_multipla',
        'sim_nao',
        'escala_numerica',
        'data',
        'upload_foto',
      ].includes(c.tipo)
    ) {
      return `Tipo invalido em "${c.label}".`;
    }
    if (c.tipo === 'selecao_multipla') {
      if (!Array.isArray(c.opcoes) || c.opcoes.length < 1) {
        return `Adicione opcoes em "${c.label}".`;
      }
    }
    if (c.tipo === 'escala_numerica') {
      const min = typeof c.min === 'number' ? c.min : 0;
      const max = typeof c.max === 'number' ? c.max : 10;
      if (max <= min) {
        return `Em "${c.label}", o maximo deve ser maior que o minimo.`;
      }
    }
  }
  return null;
}

export async function getTemplates(
  profissionalId?: string,
): Promise<Result<Template[]>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const profId = profissionalId ?? ctx.profissionalId;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('templates_anamnese')
    .select('*')
    .eq('profissional_id', profId)
    .eq('tenant_id', ctx.tenantId)
    .order('padrao', { ascending: false })
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const templates: Template[] = (data ?? []).map((row) => ({
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    profissional_id: row.profissional_id as string,
    nome: row.nome as string,
    especialidade: row.especialidade as string,
    campos: normalizarCampos(row.campos),
    padrao: Boolean(row.padrao),
    ativo: Boolean(row.ativo),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
  return { ok: true, data: templates };
}

export async function getTemplate(id: string): Promise<Result<Template>> {
  if (!id) return { ok: false, error: 'Template invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('templates_anamnese')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Template nao encontrado.' };
  if (data.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  return {
    ok: true,
    data: {
      id: data.id as string,
      tenant_id: data.tenant_id as string,
      profissional_id: data.profissional_id as string,
      nome: data.nome as string,
      especialidade: data.especialidade as string,
      campos: normalizarCampos(data.campos),
      padrao: Boolean(data.padrao),
      ativo: Boolean(data.ativo),
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
    },
  };
}

export type CriarTemplateInput = {
  nome: string;
  especialidade: string;
  campos: CampoTemplate[];
  padrao?: boolean;
};

export async function criarTemplate(
  input: CriarTemplateInput,
): Promise<Result<{ id: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 2) return { ok: false, error: 'Nome do template obrigatorio.' };
  const especialidade = input.especialidade?.trim() ?? '';
  if (especialidade.length < 2) {
    return { ok: false, error: 'Especialidade obrigatoria.' };
  }
  const campos = normalizarCampos(input.campos);
  const errCampos = validarCampos(campos);
  if (errCampos) return { ok: false, error: errCampos };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('templates_anamnese')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      nome,
      especialidade,
      campos,
      padrao: Boolean(input.padrao),
      ativo: true,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao criar template.' };
  }

  revalidatePath('/configuracoes');
  return { ok: true, data: { id: data.id as string } };
}

export type AtualizarTemplateInput = {
  nome?: string;
  especialidade?: string;
  campos?: CampoTemplate[];
  ativo?: boolean;
};

export async function atualizarTemplate(
  id: string,
  input: AtualizarTemplateInput,
): Promise<Result<null>> {
  if (!id) return { ok: false, error: 'Template invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('templates_anamnese')
    .select('id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Template nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const update: Record<string, unknown> = {};

  if (input.nome !== undefined) {
    const nome = input.nome.trim();
    if (nome.length < 2) return { ok: false, error: 'Nome do template invalido.' };
    update.nome = nome;
  }
  if (input.especialidade !== undefined) {
    const esp = input.especialidade.trim();
    if (esp.length < 2) return { ok: false, error: 'Especialidade invalida.' };
    update.especialidade = esp;
  }
  if (input.campos !== undefined) {
    const campos = normalizarCampos(input.campos);
    const errCampos = validarCampos(campos);
    if (errCampos) return { ok: false, error: errCampos };
    update.campos = campos;
  }
  if (input.ativo !== undefined) {
    update.ativo = Boolean(input.ativo);
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, data: null };
  }

  const { error } = await admin
    .from('templates_anamnese')
    .update(update)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

export async function excluirTemplate(id: string): Promise<Result<null>> {
  return atualizarTemplate(id, { ativo: false });
}

export async function duplicarTemplate(
  id: string,
): Promise<Result<{ id: string }>> {
  if (!id) return { ok: false, error: 'Template invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('templates_anamnese')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Template nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  // Regenera ids dos campos para nao conflitar com o original
  const camposOriginais = normalizarCampos(row.campos);
  const camposCopia = camposOriginais.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
  }));

  const nomeOriginal = (row.nome as string) ?? 'Template';
  const nomeCopia = nomeOriginal.startsWith('Copia de ')
    ? nomeOriginal
    : `Copia de ${nomeOriginal}`;

  const { data, error } = await admin
    .from('templates_anamnese')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      nome: nomeCopia,
      especialidade: row.especialidade as string,
      campos: camposCopia,
      padrao: false,
      ativo: true,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao duplicar.' };
  }

  revalidatePath('/configuracoes');
  return { ok: true, data: { id: data.id as string } };
}

export async function getAnamneses(
  pacienteId: string,
): Promise<Result<Anamnese[]>> {
  if (!pacienteId) return { ok: false, error: 'Paciente invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('anamneses')
    .select('*, templates_anamnese(nome, campos)')
    .eq('paciente_id', pacienteId)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };

  const anamneses: Anamnese[] = (data ?? []).map((row) => {
    const tplRaw = Array.isArray(row.templates_anamnese)
      ? row.templates_anamnese[0]
      : row.templates_anamnese;
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      paciente_id: row.paciente_id as string,
      profissional_id: row.profissional_id as string,
      agendamento_id: (row.agendamento_id as string | null) ?? null,
      template_id: (row.template_id as string | null) ?? null,
      template_nome: (tplRaw?.nome as string | null) ?? null,
      template_campos: normalizarCampos(tplRaw?.campos),
      dados: (row.dados as Record<string, unknown>) ?? {},
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  });

  return { ok: true, data: anamneses };
}

export async function getAnamnese(id: string): Promise<Result<Anamnese>> {
  if (!id) return { ok: false, error: 'Anamnese invalida.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('anamneses')
    .select('*, templates_anamnese(nome, campos)')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Anamnese nao encontrada.' };
  if (data.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const tplRaw = Array.isArray(data.templates_anamnese)
    ? data.templates_anamnese[0]
    : data.templates_anamnese;

  return {
    ok: true,
    data: {
      id: data.id as string,
      tenant_id: data.tenant_id as string,
      paciente_id: data.paciente_id as string,
      profissional_id: data.profissional_id as string,
      agendamento_id: (data.agendamento_id as string | null) ?? null,
      template_id: (data.template_id as string | null) ?? null,
      template_nome: (tplRaw?.nome as string | null) ?? null,
      template_campos: normalizarCampos(tplRaw?.campos),
      dados: (data.dados as Record<string, unknown>) ?? {},
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
    },
  };
}

export type CriarAnamneseInput = {
  pacienteId: string;
  templateId?: string;
  agendamentoId?: string;
  dados: Record<string, unknown>;
};

export async function criarAnamnese(
  input: CriarAnamneseInput,
): Promise<Result<{ id: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  if (!input.pacienteId) {
    return { ok: false, error: 'Paciente obrigatorio.' };
  }
  if (!input.dados || typeof input.dados !== 'object') {
    return { ok: false, error: 'Dados invalidos.' };
  }

  const admin = createAdminClient();

  const { data: pac, error: pacErr } = await admin
    .from('pacientes')
    .select('id, tenant_id')
    .eq('id', input.pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac || pac.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Paciente nao encontrado.' };
  }

  const { data, error } = await admin
    .from('anamneses')
    .insert({
      tenant_id: ctx.tenantId,
      paciente_id: input.pacienteId,
      profissional_id: ctx.profissionalId,
      agendamento_id: input.agendamentoId ?? null,
      template_id: input.templateId ?? null,
      dados: input.dados,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao criar anamnese.' };
  }

  revalidatePath(`/pacientes/${input.pacienteId}`);
  return { ok: true, data: { id: data.id as string } };
}

// ============================================================
// UPLOAD DE FOTO DE CAMPO upload_foto
// ============================================================

const ANAMNESE_FOTO_BUCKET = 'anamnese-fotos';
const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TIPOS_FOTO_VALIDOS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export async function uploadFotoAnamnese(
  formData: FormData,
): Promise<Result<{ url: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: 'Arquivo invalido.' };
  }
  if (arquivo.size > MAX_FOTO_BYTES) {
    return { ok: false, error: 'Imagem acima de 5MB.' };
  }
  if (!TIPOS_FOTO_VALIDOS.includes(arquivo.type)) {
    return { ok: false, error: 'Use PNG, JPG ou WebP.' };
  }

  const ext =
    arquivo.type === 'image/png'
      ? 'png'
      : arquivo.type === 'image/webp'
        ? 'webp'
        : 'jpg';
  const path = `${ctx.tenantId}/${ctx.profissionalId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const buffer = new Uint8Array(await arquivo.arrayBuffer());
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(ANAMNESE_FOTO_BUCKET)
    .upload(path, buffer, {
      contentType: arquivo.type,
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Falha no upload: ${upErr.message}` };
  }

  const { data: pub } = admin.storage
    .from(ANAMNESE_FOTO_BUCKET)
    .getPublicUrl(path);
  const url = pub?.publicUrl ?? null;
  if (!url) return { ok: false, error: 'Falha ao gerar URL publica.' };

  return { ok: true, data: { url } };
}

// ============================================================
// SEED DE TEMPLATES PADRAO POR ESPECIALIDADE
// ============================================================

function fisioterapiaCampos(): CampoTemplate[] {
  return [
    { id: crypto.randomUUID(), label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { id: crypto.randomUUID(), label: 'Inicio dos sintomas', tipo: 'data', obrigatorio: false, ordem: 2 },
    {
      id: crypto.randomUUID(),
      label: 'Localizacao da dor',
      tipo: 'selecao_multipla',
      obrigatorio: false,
      opcoes: [
        'Cervical',
        'Toracica',
        'Lombar',
        'Ombro',
        'Cotovelo',
        'Punho',
        'Quadril',
        'Joelho',
        'Tornozelo',
        'Outro',
      ],
      ordem: 3,
    },
    {
      id: crypto.randomUUID(),
      label: 'Intensidade da dor',
      tipo: 'escala_numerica',
      obrigatorio: false,
      min: 0,
      max: 10,
      ordem: 4,
    },
    { id: crypto.randomUUID(), label: 'Fator de melhora', tipo: 'texto_livre', obrigatorio: false, ordem: 5 },
    { id: crypto.randomUUID(), label: 'Fator de piora', tipo: 'texto_livre', obrigatorio: false, ordem: 6 },
    { id: crypto.randomUUID(), label: 'Pratica atividade fisica', tipo: 'sim_nao', obrigatorio: false, ordem: 7 },
    { id: crypto.randomUUID(), label: 'Cirurgias anteriores', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
    { id: crypto.randomUUID(), label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 9 },
    { id: crypto.randomUUID(), label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 10 },
  ];
}

function podologiaCampos(): CampoTemplate[] {
  return [
    { id: crypto.randomUUID(), label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    {
      id: crypto.randomUUID(),
      label: 'Tipo de calcado habitual',
      tipo: 'selecao_multipla',
      obrigatorio: false,
      opcoes: ['Aberto', 'Fechado', 'Esportivo', 'Salto', 'Outro'],
      ordem: 2,
    },
    { id: crypto.randomUUID(), label: 'Presenca de calos', tipo: 'sim_nao', obrigatorio: false, ordem: 3 },
    { id: crypto.randomUUID(), label: 'Presenca de micose', tipo: 'sim_nao', obrigatorio: false, ordem: 4 },
    { id: crypto.randomUUID(), label: 'Unha encravada', tipo: 'sim_nao', obrigatorio: false, ordem: 5 },
    { id: crypto.randomUUID(), label: 'Diabetes', tipo: 'sim_nao', obrigatorio: false, ordem: 6 },
    { id: crypto.randomUUID(), label: 'Problemas circulatorios', tipo: 'sim_nao', obrigatorio: false, ordem: 7 },
    { id: crypto.randomUUID(), label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
    { id: crypto.randomUUID(), label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 9 },
  ];
}

function nutricaoCampos(): CampoTemplate[] {
  return [
    {
      id: crypto.randomUUID(),
      label: 'Objetivo',
      tipo: 'selecao_multipla',
      obrigatorio: false,
      opcoes: [
        'Emagrecimento',
        'Ganho de massa',
        'Saude geral',
        'Controle de doenca',
        'Outro',
      ],
      ordem: 1,
    },
    { id: crypto.randomUUID(), label: 'Alergias alimentares', tipo: 'texto_livre', obrigatorio: false, ordem: 2 },
    {
      id: crypto.randomUUID(),
      label: 'Intolerancias',
      tipo: 'selecao_multipla',
      obrigatorio: false,
      opcoes: ['Lactose', 'Gluten', 'Outro', 'Nenhuma'],
      ordem: 3,
    },
    {
      id: crypto.randomUUID(),
      label: 'Refeicoes por dia',
      tipo: 'escala_numerica',
      obrigatorio: false,
      min: 1,
      max: 8,
      ordem: 4,
    },
    { id: crypto.randomUUID(), label: 'Consome alcool', tipo: 'sim_nao', obrigatorio: false, ordem: 5 },
    { id: crypto.randomUUID(), label: 'Pratica atividade fisica', tipo: 'sim_nao', obrigatorio: false, ordem: 6 },
    { id: crypto.randomUUID(), label: 'Frequencia atividade', tipo: 'texto_livre', obrigatorio: false, ordem: 7 },
    { id: crypto.randomUUID(), label: 'Historico de dietas', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
    { id: crypto.randomUUID(), label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 9 },
    { id: crypto.randomUUID(), label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 10 },
  ];
}

function psicologiaCampos(): CampoTemplate[] {
  return [
    { id: crypto.randomUUID(), label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { id: crypto.randomUUID(), label: 'Historico de acompanhamento psicologico', tipo: 'sim_nao', obrigatorio: false, ordem: 2 },
    { id: crypto.randomUUID(), label: 'Uso de medicacao psiquiatrica', tipo: 'sim_nao', obrigatorio: false, ordem: 3 },
    { id: crypto.randomUUID(), label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 4 },
    {
      id: crypto.randomUUID(),
      label: 'Qualidade do sono',
      tipo: 'selecao_multipla',
      obrigatorio: false,
      opcoes: ['Bom', 'Regular', 'Ruim', 'Insonia'],
      ordem: 5,
    },
    {
      id: crypto.randomUUID(),
      label: 'Nivel de ansiedade',
      tipo: 'escala_numerica',
      obrigatorio: false,
      min: 0,
      max: 10,
      ordem: 6,
    },
    {
      id: crypto.randomUUID(),
      label: 'Nivel de humor',
      tipo: 'escala_numerica',
      obrigatorio: false,
      min: 0,
      max: 10,
      ordem: 7,
    },
    { id: crypto.randomUUID(), label: 'Atividade fisica regular', tipo: 'sim_nao', obrigatorio: false, ordem: 8 },
    {
      id: crypto.randomUUID(),
      label: 'Rede de apoio',
      tipo: 'selecao_multipla',
      obrigatorio: false,
      opcoes: ['Familia', 'Amigos', 'Parceiro', 'Terapeuta', 'Nenhuma'],
      ordem: 9,
    },
    { id: crypto.randomUUID(), label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 10 },
  ];
}

function geralCampos(): CampoTemplate[] {
  return [
    { id: crypto.randomUUID(), label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { id: crypto.randomUUID(), label: 'Historico medico', tipo: 'texto_livre', obrigatorio: false, ordem: 2 },
    { id: crypto.randomUUID(), label: 'Alergias', tipo: 'texto_livre', obrigatorio: false, ordem: 3 },
    { id: crypto.randomUUID(), label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 4 },
    { id: crypto.randomUUID(), label: 'Cirurgias anteriores', tipo: 'texto_livre', obrigatorio: false, ordem: 5 },
    { id: crypto.randomUUID(), label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 6 },
  ];
}

function templatePadraoParaEspecialidade(
  especialidade: string,
): { nome: string; campos: CampoTemplate[] } {
  const esp = (especialidade ?? '').toLowerCase();
  if (esp.includes('fisio')) {
    return { nome: 'Anamnese Fisioterapia', campos: fisioterapiaCampos() };
  }
  if (esp.includes('podolog')) {
    return { nome: 'Anamnese Podologia', campos: podologiaCampos() };
  }
  if (esp.includes('nutri')) {
    return { nome: 'Anamnese Nutricao', campos: nutricaoCampos() };
  }
  if (esp.includes('psico')) {
    return { nome: 'Anamnese Psicologia', campos: psicologiaCampos() };
  }
  return { nome: 'Anamnese Geral', campos: geralCampos() };
}

export async function seedTemplatesAnamnese(
  profissionalId: string,
  tenantId: string,
  especialidade: string,
): Promise<{ inserido: boolean; templateId: string | null; nome: string }> {
  const admin = createAdminClient();

  const tpl = templatePadraoParaEspecialidade(especialidade);

  const { data: existentes, error: errBusca } = await admin
    .from('templates_anamnese')
    .select('id, nome')
    .eq('profissional_id', profissionalId)
    .eq('tenant_id', tenantId)
    .eq('nome', tpl.nome)
    .limit(1);
  if (errBusca) {
    throw new Error(`seedTemplatesAnamnese busca: ${errBusca.message}`);
  }
  if (existentes && existentes.length > 0) {
    return {
      inserido: false,
      templateId: existentes[0].id as string,
      nome: tpl.nome,
    };
  }

  const { data, error } = await admin
    .from('templates_anamnese')
    .insert({
      tenant_id: tenantId,
      profissional_id: profissionalId,
      nome: tpl.nome,
      especialidade,
      campos: tpl.campos,
      padrao: true,
      ativo: true,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(
      `seedTemplatesAnamnese insert: ${error?.message ?? 'falha desconhecida'}`,
    );
  }
  return { inserido: true, templateId: data.id as string, nome: tpl.nome };
}
