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
  padrao_pre_consulta: boolean;
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
    padrao_pre_consulta: Boolean(row.padrao_pre_consulta),
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
      padrao_pre_consulta: Boolean(data.padrao_pre_consulta),
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

export async function temTemplatePadraoPreConsulta(): Promise<Result<boolean>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { count, error } = await admin
    .from('templates_anamnese')
    .select('id', { count: 'exact', head: true })
    .eq('profissional_id', ctx.profissionalId)
    .eq('tenant_id', ctx.tenantId)
    .eq('padrao_pre_consulta', true)
    .eq('ativo', true);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (count ?? 0) > 0 };
}

export async function definirTemplatePadraoPreConsulta(
  id: string | null,
): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  if (id) {
    const { data: row, error: getErr } = await admin
      .from('templates_anamnese')
      .select('id, tenant_id, profissional_id, ativo')
      .eq('id', id)
      .maybeSingle();
    if (getErr) return { ok: false, error: getErr.message };
    if (!row) return { ok: false, error: 'Template nao encontrado.' };
    if (row.tenant_id !== ctx.tenantId) {
      return { ok: false, error: 'Sem permissao.' };
    }
    if (row.profissional_id !== ctx.profissionalId) {
      return { ok: false, error: 'Sem permissao.' };
    }
    if (!row.ativo) {
      return { ok: false, error: 'Ative o template antes de defini-lo como padrao.' };
    }
  }

  const { error: clearErr } = await admin
    .from('templates_anamnese')
    .update({ padrao_pre_consulta: false })
    .eq('profissional_id', ctx.profissionalId)
    .eq('tenant_id', ctx.tenantId)
    .eq('padrao_pre_consulta', true);
  if (clearErr) return { ok: false, error: clearErr.message };

  if (id) {
    const { error: setErr } = await admin
      .from('templates_anamnese')
      .update({ padrao_pre_consulta: true })
      .eq('id', id);
    if (setErr) return { ok: false, error: setErr.message };
  }

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
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

type CampoSeed = Omit<CampoTemplate, 'id'>;

function comIds(campos: CampoSeed[]): CampoTemplate[] {
  return campos.map((c, i) => ({
    ...c,
    id: crypto.randomUUID(),
    ordem: c.ordem ?? i + 1,
  }));
}

// ----- PODOLOGIA -----

function podologiaPrimeiraConsulta(): CampoSeed[] {
  return [
    { label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Inicio dos sintomas', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Menos de 1 semana', '1-4 semanas', '1-6 meses', 'Mais de 6 meses', 'Cronico'], ordem: 2 },
    { label: 'Intensidade da dor', tipo: 'escala_numerica', obrigatorio: false, min: 0, max: 10, ordem: 3 },
    { label: 'Tipo de calcado habitual', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Aberto', 'Fechado', 'Esportivo', 'Salto alto', 'Bota', 'Chinelo'], ordem: 4 },
    { label: 'Profissao (tempo em pe/sentado)', tipo: 'texto_livre', obrigatorio: false, ordem: 5 },
    { label: 'Presenca de calos/calosidades', tipo: 'sim_nao', obrigatorio: false, ordem: 6 },
    { label: 'Presenca de micose (unhas ou pele)', tipo: 'sim_nao', obrigatorio: false, ordem: 7 },
    { label: 'Unha encravada', tipo: 'sim_nao', obrigatorio: false, ordem: 8 },
    { label: 'Fissuras/rachaduras nos pes', tipo: 'sim_nao', obrigatorio: false, ordem: 9 },
    { label: 'Verrugas plantares', tipo: 'sim_nao', obrigatorio: false, ordem: 10 },
    { label: 'Diabetes', tipo: 'sim_nao', obrigatorio: true, ordem: 11 },
    { label: 'Tipo de diabetes (se sim)', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Tipo 1', 'Tipo 2', 'Gestacional', 'Nao sabe'], ordem: 12 },
    { label: 'Problemas circulatorios (varizes, trombose)', tipo: 'sim_nao', obrigatorio: false, ordem: 13 },
    { label: 'Neuropatia periferica (perda de sensibilidade)', tipo: 'sim_nao', obrigatorio: false, ordem: 14 },
    { label: 'Alergias (medicamentos, latex, esmaltes)', tipo: 'texto_livre', obrigatorio: false, ordem: 15 },
    { label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 16 },
    { label: 'Tratamentos anteriores nos pes', tipo: 'texto_livre', obrigatorio: false, ordem: 17 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 18 },
  ];
}

function podologiaRetorno(): CampoSeed[] {
  return [
    { label: 'Evolucao desde a ultima consulta', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Melhorou', 'Igual', 'Piorou'], ordem: 1 },
    { label: 'Queixa atual', tipo: 'texto_livre', obrigatorio: false, ordem: 2 },
    { label: 'Intensidade da dor atual', tipo: 'escala_numerica', obrigatorio: false, min: 0, max: 10, ordem: 3 },
    { label: 'Seguiu as orientacoes', tipo: 'sim_nao', obrigatorio: false, ordem: 4 },
    { label: 'Mudou calcado', tipo: 'sim_nao', obrigatorio: false, ordem: 5 },
    { label: 'Novos sintomas', tipo: 'texto_livre', obrigatorio: false, ordem: 6 },
    { label: 'Alteracao em medicamentos', tipo: 'texto_livre', obrigatorio: false, ordem: 7 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
  ];
}

function podologiaPeDiabetico(): CampoSeed[] {
  return [
    { label: 'Tipo de diabetes', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Tipo 1', 'Tipo 2', 'Gestacional'], ordem: 1 },
    { label: 'Tempo de diagnostico', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Menos de 1 ano', '1-5 anos', '5-10 anos', 'Mais de 10 anos'], ordem: 2 },
    { label: 'Ultima glicemia (valor)', tipo: 'texto_livre', obrigatorio: false, ordem: 3 },
    { label: 'Hemoglobina glicada (HbA1c)', tipo: 'texto_livre', obrigatorio: false, ordem: 4 },
    { label: 'Sensibilidade dos pes preservada', tipo: 'sim_nao', obrigatorio: true, ordem: 5 },
    { label: 'Pulsos pediosos palpaveis', tipo: 'sim_nao', obrigatorio: false, ordem: 6 },
    { label: 'Presenca de feridas/ulceras', tipo: 'sim_nao', obrigatorio: true, ordem: 7 },
    { label: 'Localizacao das lesoes', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Halux', 'Dedos', 'Planta', 'Calcanhar', 'Dorso', 'Lateral'], ordem: 8 },
    { label: 'Deformidades (joanete, dedos em garra)', tipo: 'sim_nao', obrigatorio: false, ordem: 9 },
    { label: 'Calosidades em areas de pressao', tipo: 'sim_nao', obrigatorio: false, ordem: 10 },
    { label: 'Historico de amputacao', tipo: 'sim_nao', obrigatorio: false, ordem: 11 },
    { label: 'Acompanhamento com endocrinologista', tipo: 'sim_nao', obrigatorio: false, ordem: 12 },
    { label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 13 },
    { label: 'Orientacoes fornecidas', tipo: 'texto_livre', obrigatorio: false, ordem: 14 },
  ];
}

// ----- FISIOTERAPIA -----

function fisioOrtopedica(): CampoSeed[] {
  return [
    { label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Inicio dos sintomas', tipo: 'data', obrigatorio: false, ordem: 2 },
    { label: 'Mecanismo de lesao', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Trauma direto', 'Esforco repetitivo', 'Movimento brusco', 'Sem causa aparente', 'Pos-cirurgico'], ordem: 3 },
    { label: 'Localizacao da dor', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Cervical', 'Toracica', 'Lombar', 'Ombro', 'Cotovelo', 'Punho/Mao', 'Quadril', 'Joelho', 'Tornozelo/Pe', 'Outro'], ordem: 4 },
    { label: 'Intensidade da dor (EVA)', tipo: 'escala_numerica', obrigatorio: true, min: 0, max: 10, ordem: 5 },
    { label: 'Tipo da dor', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Pontada', 'Queimacao', 'Peso', 'Latejante', 'Formigamento', 'Fisgada'], ordem: 6 },
    { label: 'Fator de melhora', tipo: 'texto_livre', obrigatorio: false, ordem: 7 },
    { label: 'Fator de piora', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
    { label: 'Dor ao repouso', tipo: 'sim_nao', obrigatorio: false, ordem: 9 },
    { label: 'Dor noturna', tipo: 'sim_nao', obrigatorio: false, ordem: 10 },
    { label: 'Limitacao funcional', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Andar', 'Subir escada', 'Sentar/levantar', 'Carregar peso', 'Dormir', 'Trabalhar', 'Esporte'], ordem: 11 },
    { label: 'Cirurgias anteriores', tipo: 'texto_livre', obrigatorio: false, ordem: 12 },
    { label: 'Fraturas anteriores', tipo: 'texto_livre', obrigatorio: false, ordem: 13 },
    { label: 'Doencas cronicas', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Hipertensao', 'Diabetes', 'Artrite', 'Artrose', 'Osteoporose', 'Fibromialgia', 'Nenhuma'], ordem: 14 },
    { label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 15 },
    { label: 'Exames de imagem realizados', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Raio-X', 'Ressonancia', 'Tomografia', 'Ultrassom', 'Nenhum'], ordem: 16 },
    { label: 'Pratica atividade fisica', tipo: 'sim_nao', obrigatorio: false, ordem: 17 },
    { label: 'Qual atividade e frequencia', tipo: 'texto_livre', obrigatorio: false, ordem: 18 },
    { label: 'Profissao e postura no trabalho', tipo: 'texto_livre', obrigatorio: false, ordem: 19 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 20 },
  ];
}

function fisioNeurologica(): CampoSeed[] {
  return [
    { label: 'Diagnostico neurologico', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['AVC', 'Parkinson', 'Esclerose multipla', 'Lesao medular', 'TCE', 'Paralisia cerebral', 'Neuropatia', 'Outro'], ordem: 1 },
    { label: 'Tempo de diagnostico', tipo: 'texto_livre', obrigatorio: false, ordem: 2 },
    { label: 'Lado acometido', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Direito', 'Esquerdo', 'Bilateral'], ordem: 3 },
    { label: 'Nivel de consciencia', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Alerta', 'Sonolento', 'Confuso'], ordem: 4 },
    { label: 'Marcha', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Independente', 'Com auxilio', 'Cadeira de rodas', 'Acamado'], ordem: 5 },
    { label: 'Equilibrio', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Normal', 'Alterado em pe', 'Alterado sentado'], ordem: 6 },
    { label: 'Tonus muscular', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Normal', 'Hipotonia', 'Hipertonia/Espasticidade'], ordem: 7 },
    { label: 'Sensibilidade', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Preservada', 'Diminuida', 'Ausente'], ordem: 8 },
    { label: 'Dor', tipo: 'escala_numerica', obrigatorio: false, min: 0, max: 10, ordem: 9 },
    { label: 'Dificuldade de fala/degluticao', tipo: 'sim_nao', obrigatorio: false, ordem: 10 },
    { label: 'Incontinencia', tipo: 'sim_nao', obrigatorio: false, ordem: 11 },
    { label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 12 },
    { label: 'Fisioterapia anterior', tipo: 'sim_nao', obrigatorio: false, ordem: 13 },
    { label: 'Objetivos do paciente', tipo: 'texto_livre', obrigatorio: false, ordem: 14 },
    { label: 'Cuidador/Acompanhante', tipo: 'texto_livre', obrigatorio: false, ordem: 15 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 16 },
  ];
}

function fisioRespiratoria(): CampoSeed[] {
  return [
    { label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Diagnostico respiratorio', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Asma', 'DPOC', 'Bronquite', 'Pneumonia', 'Pos-COVID', 'Fibrose', 'Pos-operatorio toracico', 'Outro'], ordem: 2 },
    { label: 'Dispneia', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Repouso', 'Pequenos esforcos', 'Moderados esforcos', 'Grandes esforcos', 'Sem dispneia'], ordem: 3 },
    { label: 'Tosse', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Seca', 'Produtiva', 'Noturna', 'Sem tosse'], ordem: 4 },
    { label: 'Tabagismo', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Nunca fumou', 'Ex-tabagista', 'Fumante ativo'], ordem: 5 },
    { label: 'Tempo de tabagismo (se aplicavel)', tipo: 'texto_livre', obrigatorio: false, ordem: 6 },
    { label: 'Oxigenoterapia domiciliar', tipo: 'sim_nao', obrigatorio: false, ordem: 7 },
    { label: 'Saturacao habitual', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
    { label: 'Internacoes recentes', tipo: 'sim_nao', obrigatorio: false, ordem: 9 },
    { label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 10 },
    { label: 'Exames realizados', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Espirometria', 'Raio-X torax', 'Tomografia', 'Gasometria', 'Nenhum'], ordem: 11 },
    { label: 'Pratica atividade fisica', tipo: 'sim_nao', obrigatorio: false, ordem: 12 },
    { label: 'Limitacao funcional', tipo: 'texto_livre', obrigatorio: false, ordem: 13 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 14 },
  ];
}

// ----- NUTRICAO -----

function nutricaoInicial(): CampoSeed[] {
  return [
    { label: 'Objetivo da consulta', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Emagrecimento', 'Ganho de massa', 'Saude geral', 'Controle de doenca', 'Gestacao', 'Esportivo', 'Vegetariano/Vegano', 'Outro'], ordem: 1 },
    { label: 'Peso atual (kg)', tipo: 'texto_livre', obrigatorio: true, ordem: 2 },
    { label: 'Altura (cm)', tipo: 'texto_livre', obrigatorio: true, ordem: 3 },
    { label: 'Peso desejado (kg)', tipo: 'texto_livre', obrigatorio: false, ordem: 4 },
    { label: 'Historico de dietas anteriores', tipo: 'texto_livre', obrigatorio: false, ordem: 5 },
    { label: 'Resultado das dietas', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Perdeu e manteve', 'Perdeu e recuperou (efeito sanfona)', 'Nao conseguiu seguir', 'Nunca fez dieta'], ordem: 6 },
    { label: 'Alergias alimentares', tipo: 'texto_livre', obrigatorio: false, ordem: 7 },
    { label: 'Intolerancias', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Lactose', 'Gluten', 'Frutose', 'Ovo', 'Frutos do mar', 'Nenhuma', 'Outro'], ordem: 8 },
    { label: 'Restricoes alimentares', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Vegetariano', 'Vegano', 'Sem carne vermelha', 'Sem porco', 'Nenhuma'], ordem: 9 },
    { label: 'Numero de refeicoes por dia', tipo: 'escala_numerica', obrigatorio: false, min: 1, max: 8, ordem: 10 },
    { label: 'Pula refeicoes frequentemente', tipo: 'sim_nao', obrigatorio: false, ordem: 11 },
    { label: 'Consumo de agua (litros/dia)', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Menos de 1L', '1-2L', '2-3L', 'Mais de 3L'], ordem: 12 },
    { label: 'Consome alcool', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Nunca', 'Socialmente', 'Semanalmente', 'Diariamente'], ordem: 13 },
    { label: 'Tabagismo', tipo: 'sim_nao', obrigatorio: false, ordem: 14 },
    { label: 'Pratica atividade fisica', tipo: 'sim_nao', obrigatorio: false, ordem: 15 },
    { label: 'Tipo e frequencia de atividade', tipo: 'texto_livre', obrigatorio: false, ordem: 16 },
    { label: 'Qualidade do sono', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Boa', 'Regular', 'Ruim', 'Insonia'], ordem: 17 },
    { label: 'Doencas cronicas', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Diabetes', 'Hipertensao', 'Colesterol alto', 'Tireoide', 'SOP', 'Gastrite/Refluxo', 'Nenhuma'], ordem: 18 },
    { label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 19 },
    { label: 'Suplementos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 20 },
    { label: 'Funcionamento intestinal', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Regular diario', 'Irregular', 'Constipacao', 'Diarreia frequente'], ordem: 21 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 22 },
  ];
}

function nutricaoRecordatorio(): CampoSeed[] {
  return [
    { label: 'Cafe da manha (horario e alimentos)', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Lanche da manha', tipo: 'texto_livre', obrigatorio: false, ordem: 2 },
    { label: 'Almoco (horario e alimentos)', tipo: 'texto_livre', obrigatorio: true, ordem: 3 },
    { label: 'Lanche da tarde', tipo: 'texto_livre', obrigatorio: false, ordem: 4 },
    { label: 'Jantar (horario e alimentos)', tipo: 'texto_livre', obrigatorio: true, ordem: 5 },
    { label: 'Ceia', tipo: 'texto_livre', obrigatorio: false, ordem: 6 },
    { label: 'Beliscos entre refeicoes', tipo: 'texto_livre', obrigatorio: false, ordem: 7 },
    { label: 'Consumo de agua no dia', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Menos de 1L', '1-2L', '2-3L', 'Mais de 3L'], ordem: 8 },
    { label: 'Dia atipico', tipo: 'sim_nao', obrigatorio: false, ordem: 9 },
    { label: 'Observacoes (humor, local, companhia)', tipo: 'texto_livre', obrigatorio: false, ordem: 10 },
  ];
}

function nutricaoRetorno(): CampoSeed[] {
  return [
    { label: 'Peso atual (kg)', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Seguiu o plano alimentar', tipo: 'selecao_multipla', obrigatorio: true, opcoes: ['Totalmente', 'Parcialmente', 'Pouco', 'Nao conseguiu'], ordem: 2 },
    { label: 'Dificuldades encontradas', tipo: 'texto_livre', obrigatorio: false, ordem: 3 },
    { label: 'Mudancas percebidas', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Mais energia', 'Melhor sono', 'Menos inchaco', 'Perda de peso', 'Ganho de massa', 'Melhora digestao', 'Nenhuma'], ordem: 4 },
    { label: 'Sintomas gastrointestinais', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Nenhum', 'Gases', 'Constipacao', 'Diarreia', 'Refluxo', 'Nausea'], ordem: 5 },
    { label: 'Funcionamento intestinal', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Regular', 'Irregular', 'Melhorou', 'Piorou'], ordem: 6 },
    { label: 'Mudou atividade fisica', tipo: 'sim_nao', obrigatorio: false, ordem: 7 },
    { label: 'Novos medicamentos ou suplementos', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
    { label: 'Alimentos que quer incluir/excluir', tipo: 'texto_livre', obrigatorio: false, ordem: 9 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 10 },
  ];
}

// ----- PSICOLOGIA -----

function psicologiaEntrevistaInicial(): CampoSeed[] {
  return [
    { label: 'Queixa principal (motivo da consulta)', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Quando comecou a perceber o problema', tipo: 'texto_livre', obrigatorio: false, ordem: 2 },
    { label: 'Ja fez acompanhamento psicologico antes', tipo: 'sim_nao', obrigatorio: false, ordem: 3 },
    { label: 'Duracao do acompanhamento anterior', tipo: 'texto_livre', obrigatorio: false, ordem: 4 },
    { label: 'Ja fez acompanhamento psiquiatrico', tipo: 'sim_nao', obrigatorio: false, ordem: 5 },
    { label: 'Uso de medicacao psiquiatrica', tipo: 'sim_nao', obrigatorio: false, ordem: 6 },
    { label: 'Medicamentos em uso (psiquiatricos e outros)', tipo: 'texto_livre', obrigatorio: false, ordem: 7 },
    { label: 'Nivel de ansiedade atual', tipo: 'escala_numerica', obrigatorio: false, min: 0, max: 10, ordem: 8 },
    { label: 'Nivel de humor/animo atual', tipo: 'escala_numerica', obrigatorio: false, min: 0, max: 10, ordem: 9 },
    { label: 'Qualidade do sono', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Bom', 'Regular', 'Ruim', 'Insonia', 'Sono excessivo'], ordem: 10 },
    { label: 'Apetite', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Normal', 'Aumentado', 'Diminuido', 'Variavel'], ordem: 11 },
    { label: 'Pratica atividade fisica regular', tipo: 'sim_nao', obrigatorio: false, ordem: 12 },
    { label: 'Consome alcool ou outras substancias', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Nao', 'Alcool socialmente', 'Alcool frequente', 'Tabaco', 'Outras substancias'], ordem: 13 },
    { label: 'Rede de apoio', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Familia', 'Amigos', 'Parceiro(a)', 'Comunidade religiosa', 'Nenhuma'], ordem: 14 },
    { label: 'Estado civil', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Solteiro(a)', 'Casado(a)/Uniao estavel', 'Divorciado(a)', 'Viuvo(a)'], ordem: 15 },
    { label: 'Filhos', tipo: 'sim_nao', obrigatorio: false, ordem: 16 },
    { label: 'Expectativa em relacao a terapia', tipo: 'texto_livre', obrigatorio: false, ordem: 17 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 18 },
  ];
}

function psicologiaAcompanhamento(): CampoSeed[] {
  return [
    { label: 'Como esta se sentindo desde a ultima sessao', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Nivel de ansiedade', tipo: 'escala_numerica', obrigatorio: false, min: 0, max: 10, ordem: 2 },
    { label: 'Nivel de humor/animo', tipo: 'escala_numerica', obrigatorio: false, min: 0, max: 10, ordem: 3 },
    { label: 'Qualidade do sono na semana', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Bom', 'Regular', 'Ruim'], ordem: 4 },
    { label: 'Eventos significativos na semana', tipo: 'texto_livre', obrigatorio: false, ordem: 5 },
    { label: 'Conseguiu aplicar o que discutimos', tipo: 'selecao_multipla', obrigatorio: false, opcoes: ['Sim totalmente', 'Parcialmente', 'Nao conseguiu'], ordem: 6 },
    { label: 'Temas que quer abordar hoje', tipo: 'texto_livre', obrigatorio: false, ordem: 7 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 8 },
  ];
}

// ----- GERAL (fallback) -----

function geralCampos(): CampoSeed[] {
  return [
    { label: 'Queixa principal', tipo: 'texto_livre', obrigatorio: true, ordem: 1 },
    { label: 'Historico medico', tipo: 'texto_livre', obrigatorio: false, ordem: 2 },
    { label: 'Alergias', tipo: 'texto_livre', obrigatorio: false, ordem: 3 },
    { label: 'Medicamentos em uso', tipo: 'texto_livre', obrigatorio: false, ordem: 4 },
    { label: 'Cirurgias anteriores', tipo: 'texto_livre', obrigatorio: false, ordem: 5 },
    { label: 'Observacoes', tipo: 'texto_livre', obrigatorio: false, ordem: 6 },
  ];
}

type ModeloSeed = { nome: string; campos: CampoTemplate[] };

function modelosParaEspecialidade(especialidade: string): ModeloSeed[] {
  const esp = (especialidade ?? '').toLowerCase();
  if (esp.includes('podolog')) {
    return [
      { nome: 'Anamnese Podologia - Primeira consulta', campos: comIds(podologiaPrimeiraConsulta()) },
      { nome: 'Anamnese Podologia - Retorno', campos: comIds(podologiaRetorno()) },
      { nome: 'Anamnese Podologia - Pe diabetico', campos: comIds(podologiaPeDiabetico()) },
    ];
  }
  if (esp.includes('fisio')) {
    return [
      { nome: 'Avaliacao Ortopedica', campos: comIds(fisioOrtopedica()) },
      { nome: 'Avaliacao Neurologica', campos: comIds(fisioNeurologica()) },
      { nome: 'Avaliacao Respiratoria', campos: comIds(fisioRespiratoria()) },
    ];
  }
  if (esp.includes('nutri')) {
    return [
      { nome: 'Consulta Inicial Nutricao', campos: comIds(nutricaoInicial()) },
      { nome: 'Recordatorio Alimentar 24h', campos: comIds(nutricaoRecordatorio()) },
      { nome: 'Retorno Nutricional', campos: comIds(nutricaoRetorno()) },
    ];
  }
  if (esp.includes('psico')) {
    return [
      { nome: 'Entrevista Inicial Psicologia', campos: comIds(psicologiaEntrevistaInicial()) },
      { nome: 'Acompanhamento Psicologia', campos: comIds(psicologiaAcompanhamento()) },
    ];
  }
  return [{ nome: 'Anamnese Geral', campos: comIds(geralCampos()) }];
}

export type SeedTemplatesResultado = {
  inseridos: number;
  existentes: number;
  total: number;
  nomes: string[];
};

export async function seedTemplatesAnamnese(
  profissionalId: string,
  tenantId: string,
  especialidade: string,
): Promise<SeedTemplatesResultado> {
  const admin = createAdminClient();
  const modelos = modelosParaEspecialidade(especialidade);

  const nomes = modelos.map((m) => m.nome);

  const { data: existentes, error: errBusca } = await admin
    .from('templates_anamnese')
    .select('id, nome')
    .eq('profissional_id', profissionalId)
    .eq('tenant_id', tenantId)
    .in('nome', nomes);
  if (errBusca) {
    throw new Error(`seedTemplatesAnamnese busca: ${errBusca.message}`);
  }

  const jaExistentes = new Set(
    (existentes ?? []).map((r) => r.nome as string),
  );
  const aInserir = modelos.filter((m) => !jaExistentes.has(m.nome));

  if (aInserir.length === 0) {
    return {
      inseridos: 0,
      existentes: jaExistentes.size,
      total: modelos.length,
      nomes: modelos.map((m) => m.nome),
    };
  }

  const rows = aInserir.map((m, i) => ({
    tenant_id: tenantId,
    profissional_id: profissionalId,
    nome: m.nome,
    especialidade,
    campos: m.campos,
    // Primeiro modelo da especialidade vira o padrao se nao houver outro padrao
    padrao: i === 0 && jaExistentes.size === 0,
    ativo: true,
  }));

  const { error } = await admin.from('templates_anamnese').insert(rows);
  if (error) {
    throw new Error(`seedTemplatesAnamnese insert: ${error.message}`);
  }

  return {
    inseridos: rows.length,
    existentes: jaExistentes.size,
    total: modelos.length,
    nomes: modelos.map((m) => m.nome),
  };
}
