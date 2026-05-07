'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { cleanCPF, cleanPhone } from '@/lib/masks';
import { isValidBirthDate, isMinor, validateCPF } from '@/lib/validators';
import {
  normalizarOrigem,
  type OrigemPaciente,
} from '@/lib/paciente-origem';
import { enviarNotificacaoEmail } from '@/lib/notificacoes';
import {
  capitalizeNome,
  emailConfirmacaoPreConsulta,
  montarLinkAgendamento,
} from '@/lib/email-templates';
import type { CampoTemplate, CampoTipo } from '@/actions/anamnese';

type Genero = 'masculino' | 'feminino' | 'prefiro_nao_informar';
type GrauParentesco = 'mae' | 'pai' | 'avo' | 'tio' | 'outro';
type ContatoPreferencial = 'whatsapp' | 'telefone' | 'email' | 'sms';

const CONTATOS_VALIDOS: readonly ContatoPreferencial[] = [
  'whatsapp',
  'telefone',
  'email',
  'sms',
];

function parseContatoPreferencial(raw: unknown): ContatoPreferencial {
  return typeof raw === 'string' &&
    (CONTATOS_VALIDOS as readonly string[]).includes(raw)
    ? (raw as ContatoPreferencial)
    : 'whatsapp';
}

const LGPD_TEXT_PRECONSULTA =
  'Termo de consentimento LGPD aceito pelo paciente em pre-consulta. ' +
  'Autoriza tratamento de dados pessoais e sensiveis para finalidade clinica e administrativa, ' +
  'conforme Lei 13.709/2018.';

async function resolverContextoSlug(slug: string): Promise<
  | {
      ok: true;
      tenantId: string;
      slug: string;
      profissional: {
        id: string;
        nome: string;
        email: string;
        especialidade: string | null;
        logo_url: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const cleanSlug = (slug ?? '').trim().toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
    return { ok: false, error: 'Link invalido.' };
  }

  const admin = createAdminClient();
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', cleanSlug)
    .maybeSingle();
  if (tErr) return { ok: false, error: tErr.message };
  if (!tenant) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: prof, error: pErr } = await admin
    .from('profissionais')
    .select('id, nome, email, especialidade, logo_url')
    .eq('tenant_id', tenant.id as string)
    .eq('ativo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pErr) return { ok: false, error: pErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  return {
    ok: true,
    tenantId: tenant.id as string,
    slug: cleanSlug,
    profissional: {
      id: prof.id as string,
      nome: prof.nome as string,
      email: prof.email as string,
      especialidade: (prof.especialidade as string | null) ?? null,
      logo_url: (prof.logo_url as string | null) ?? null,
    },
  };
}

export async function verificarPacientePreConsulta(
  slug: string,
  cpf: string,
): Promise<
  | { ok: true; existe: false }
  | { ok: true; existe: true; paciente: { id: string; nome: string } }
  | { ok: false; error: string }
> {
  const ctx = await resolverContextoSlug(slug);
  if (!ctx.ok) return ctx;

  const cpfDigits = cleanCPF(cpf);
  if (!validateCPF(cpfDigits)) {
    return { ok: false, error: 'CPF invalido.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('pacientes')
    .select('id, nome')
    .eq('tenant_id', ctx.tenantId)
    .eq('cpf', cpfDigits)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, existe: false };
  return {
    ok: true,
    existe: true,
    paciente: { id: data.id as string, nome: data.nome as string },
  };
}

export type CadastroPreConsultaInput = {
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

export async function cadastrarPacientePreConsulta(
  input: CadastroPreConsultaInput,
): Promise<
  | { ok: true; pacienteId: string }
  | { ok: false; error: string }
> {
  if (!input.aceiteLgpd) {
    return { ok: false, error: 'E necessario aceitar o termo LGPD.' };
  }
  const ctx = await resolverContextoSlug(input.slug);
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 3) return { ok: false, error: 'Nome invalido.' };

  const cpf = cleanCPF(input.cpf ?? '');
  if (cpf.length !== 11) {
    return { ok: false, error: 'CPF deve ter 11 digitos.' };
  }

  const { data: existing } = await admin
    .from('pacientes')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('cpf', cpf)
    .maybeSingle();
  if (existing) {
    return { ok: true, pacienteId: existing.id as string };
  }

  if (!validateCPF(cpf)) {
    return { ok: false, error: 'CPF invalido.' };
  }
  if (!isValidBirthDate(input.data_nascimento)) {
    return { ok: false, error: 'Data de nascimento invalida.' };
  }
  if (
    !['masculino', 'feminino', 'prefiro_nao_informar'].includes(input.genero)
  ) {
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
    return {
      ok: false,
      error: 'Responsavel obrigatorio para menor de idade.',
    };
  }

  const { origem, origem_detalhe } = normalizarOrigem(
    input.origem,
    input.origem_detalhe,
  );

  const contatoPreferencial = parseContatoPreferencial(
    input.contato_preferencial,
  );

  const { data: pacRow, error: pacErr } = await admin
    .from('pacientes')
    .insert({
      tenant_id: ctx.tenantId,
      nome,
      cpf,
      data_nascimento: input.data_nascimento,
      genero: input.genero,
      telefone,
      email: email,
      convenio: input.convenio?.trim() || null,
      origem,
      origem_detalhe,
      contato_preferencial: contatoPreferencial,
      ativo: true,
    })
    .select('id')
    .single();
  if (pacErr || !pacRow) {
    return { ok: false, error: pacErr?.message ?? 'Falha ao salvar paciente.' };
  }
  const pacienteId = pacRow.id as string;

  let responsavelId: string | null = null;
  if (menor && input.responsavel) {
    const r = input.responsavel;
    const respCpf = cleanCPF(r.cpf ?? '');
    if (!validateCPF(respCpf)) {
      await admin.from('pacientes').delete().eq('id', pacienteId);
      return { ok: false, error: 'CPF do responsavel invalido.' };
    }
    const respTel = cleanPhone(r.telefone ?? '');
    if (respTel.length !== 10 && respTel.length !== 11) {
      await admin.from('pacientes').delete().eq('id', pacienteId);
      return { ok: false, error: 'Telefone do responsavel invalido.' };
    }
    if (!['mae', 'pai', 'avo', 'tio', 'outro'].includes(r.grau_parentesco)) {
      await admin.from('pacientes').delete().eq('id', pacienteId);
      return { ok: false, error: 'Grau de parentesco invalido.' };
    }
    const { data: respRow, error: respErr } = await admin
      .from('responsaveis')
      .insert({
        paciente_id: pacienteId,
        nome: r.nome.trim(),
        cpf: respCpf,
        telefone: respTel,
        email: r.email?.trim() || null,
        grau_parentesco: r.grau_parentesco,
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

  const { error: consErr } = await admin.from('consentimentos').insert({
    paciente_id: pacienteId,
    responsavel_id: responsavelId,
    tipo: menor ? 'lgpd_menor' : 'lgpd_geral',
    aceite: true,
    texto_aceito: LGPD_TEXT_PRECONSULTA,
  });
  if (consErr) {
    await admin.from('pacientes').delete().eq('id', pacienteId);
    return {
      ok: false,
      error: `Falha ao registrar consentimento: ${consErr.message}`,
    };
  }

  return { ok: true, pacienteId };
}

export type TemplatePublico = {
  id: string;
  nome: string;
  campos: CampoTemplate[];
};

export type TemplatesPreConsultaResult = {
  templates: TemplatePublico[];
  padrao: TemplatePublico | null;
};

function normalizarCamposPub(raw: unknown): CampoTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const c = (item ?? {}) as Record<string, unknown>;
    const tipo = (c.tipo as CampoTipo) ?? 'texto_livre';
    const campo: CampoTemplate = {
      id: (c.id as string) ?? String(idx),
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

export async function getTemplatesPreConsulta(
  slug: string,
): Promise<
  | { ok: true; data: TemplatesPreConsultaResult }
  | { ok: false; error: string }
> {
  const ctx = await resolverContextoSlug(slug);
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('templates_anamnese')
    .select('id, nome, campos, ativo, padrao, padrao_pre_consulta')
    .eq('profissional_id', ctx.profissional.id)
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true)
    .order('padrao', { ascending: false })
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const todos: (TemplatePublico & { padrao_pre_consulta: boolean })[] = (
    data ?? []
  ).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    campos: normalizarCamposPub(row.campos),
    padrao_pre_consulta: Boolean(row.padrao_pre_consulta),
  }));

  const padraoRow = todos.find((t) => t.padrao_pre_consulta) ?? null;
  const padrao: TemplatePublico | null = padraoRow
    ? { id: padraoRow.id, nome: padraoRow.nome, campos: padraoRow.campos }
    : null;
  const templates: TemplatePublico[] = todos.map(
    ({ id, nome, campos }) => ({ id, nome, campos }),
  );

  return { ok: true, data: { templates, padrao } };
}

export async function uploadFotoAnamnesePublica(
  slug: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await resolverContextoSlug(slug);
  if (!ctx.ok) return ctx;

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: 'Arquivo invalido.' };
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'Imagem acima de 5MB.' };
  }
  const tiposValidos = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!tiposValidos.includes(arquivo.type)) {
    return { ok: false, error: 'Use PNG, JPG ou WebP.' };
  }

  const ext =
    arquivo.type === 'image/png'
      ? 'png'
      : arquivo.type === 'image/webp'
        ? 'webp'
        : 'jpg';
  const path = `${ctx.tenantId}/${ctx.profissional.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const buffer = new Uint8Array(await arquivo.arrayBuffer());

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from('anamnese-fotos')
    .upload(path, buffer, {
      contentType: arquivo.type,
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Falha no upload: ${upErr.message}` };
  }
  const { data: pub } = admin.storage
    .from('anamnese-fotos')
    .getPublicUrl(path);
  const url = pub?.publicUrl ?? null;
  if (!url) return { ok: false, error: 'Falha ao gerar URL publica.' };
  return { ok: true, url };
}

export type SalvarAnamnesePreConsultaInput = {
  slug: string;
  pacienteId: string;
  templateId: string;
  dados: Record<string, unknown>;
};

export async function salvarAnamnesePreConsulta(
  input: SalvarAnamnesePreConsultaInput,
): Promise<
  | { ok: true; anamneseId: string }
  | { ok: false; error: string }
> {
  const ctx = await resolverContextoSlug(input.slug);
  if (!ctx.ok) return ctx;
  if (!input.pacienteId || !input.templateId) {
    return { ok: false, error: 'Dados invalidos.' };
  }

  const admin = createAdminClient();

  const { data: pac, error: pacErr } = await admin
    .from('pacientes')
    .select('id, nome, email, tenant_id')
    .eq('id', input.pacienteId)
    .maybeSingle();
  if (pacErr) return { ok: false, error: pacErr.message };
  if (!pac || pac.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Paciente nao encontrado.' };
  }

  const { data: tpl, error: tplErr } = await admin
    .from('templates_anamnese')
    .select('id, nome, profissional_id, tenant_id')
    .eq('id', input.templateId)
    .maybeSingle();
  if (tplErr) return { ok: false, error: tplErr.message };
  if (
    !tpl ||
    tpl.tenant_id !== ctx.tenantId ||
    tpl.profissional_id !== ctx.profissional.id
  ) {
    return { ok: false, error: 'Template nao encontrado.' };
  }

  const { data: anaRow, error: anaErr } = await admin
    .from('anamneses')
    .insert({
      tenant_id: ctx.tenantId,
      paciente_id: input.pacienteId,
      profissional_id: ctx.profissional.id,
      template_id: input.templateId,
      dados: input.dados ?? {},
    })
    .select('id')
    .single();
  if (anaErr || !anaRow) {
    return { ok: false, error: anaErr?.message ?? 'Falha ao salvar anamnese.' };
  }

  // Notifica profissional por email
  try {
    const pacienteNome = capitalizeNome(pac.nome as string);
    const profissionalNome = capitalizeNome(ctx.profissional.nome);
    const templateNome = (tpl.nome as string) ?? 'Anamnese';
    const html = `
      <p>Ola, ${profissionalNome}.</p>
      <p><strong>${pacienteNome}</strong> preencheu a anamnese
      <strong>"${templateNome}"</strong> via pre-consulta.</p>
      <p>Acesse a ficha do paciente no painel para visualizar os dados.</p>
    `;
    await enviarNotificacaoEmail({
      tenantId: ctx.tenantId,
      agendamentoId: null,
      tipo: 'feedback',
      destino: ctx.profissional.email,
      assunto: `${pacienteNome} preencheu a anamnese`,
      html,
    });
  } catch (e) {
    console.error('[pre-consulta] erro ao notificar profissional:', e);
  }

  // Envia confirmacao ao paciente (se tiver email)
  try {
    const pacienteEmail = (pac.email as string | null)?.trim() || null;
    if (pacienteEmail) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
      const linkAgendamento = montarLinkAgendamento(baseUrl, ctx.slug);

      const tpl = emailConfirmacaoPreConsulta({
        pacienteNome: pac.nome as string,
        profissionalNome: ctx.profissional.nome,
        profissionalEspecialidade: ctx.profissional.especialidade,
        linkAgendamento,
        logoUrl: ctx.profissional.logo_url,
      });

      await enviarNotificacaoEmail({
        tenantId: ctx.tenantId,
        agendamentoId: null,
        tipo: 'feedback',
        destino: pacienteEmail,
        assunto: tpl.assunto,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error('[pre-consulta] erro ao confirmar para paciente:', e);
  }

  return { ok: true, anamneseId: anaRow.id as string };
}
