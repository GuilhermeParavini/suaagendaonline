'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cleanPhone } from '@/lib/masks';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type AssinaturaTipo = 'fonte' | 'imagem';
export type AssinaturaFonte = 'Dancing Script' | 'Great Vibes' | 'Pacifico';

export type ProfissionalConfig = {
  id: string;
  tenant_id: string;
  nome: string;
  especialidade: string;
  registro_profissional: string | null;
  email: string;
  telefone: string | null;
  bio: string | null;
  role: string;
  assinatura_tipo: AssinaturaTipo | null;
  assinatura_fonte: string | null;
  assinatura_url: string | null;
  logo_url: string | null;
  enviar_avaliacao: boolean;
  enviar_followup: boolean;
  mostrar_acompanhamento: boolean;
  followup_mensagem: string | null;
  intervalo_entre_consultas_min: number;
};

export type TenantConfig = {
  id: string;
  nome_empresa: string;
  slug: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  plano: string;
  trial_expira_em: string | null;
};

export type HorarioBloco = {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

export type Procedimento = {
  id: string;
  nome: string;
  duracao_min: number;
  valor: number | null;
  ativo: boolean;
};

async function obterContexto(): Promise<
  | { ok: true; tenantId: string; profissionalId: string; role: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof, error } = await admin
    .from('profissionais')
    .select('id, tenant_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: prof.tenant_id as string,
    profissionalId: prof.id as string,
    role: prof.role as string,
  };
}

export async function getConfiguracoes(): Promise<
  Result<{
    profissional: ProfissionalConfig;
    tenant: TenantConfig;
    horarios: HorarioBloco[];
    procedimentos: Procedimento[];
  }>
> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select(
      'id, tenant_id, nome, especialidade, registro_profissional, email, telefone, bio, role, assinatura_tipo, assinatura_fonte, assinatura_url, logo_url, enviar_avaliacao, enviar_followup, mostrar_acompanhamento, followup_mensagem, intervalo_entre_consultas_min',
    )
    .eq('id', ctx.profissionalId)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select(
      'id, nome_empresa, slug, telefone, email, endereco, cidade, estado, plano, trial_expira_em',
    )
    .eq('id', ctx.tenantId)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: tenantErr.message };
  if (!tenant) return { ok: false, error: 'Tenant nao encontrado.' };

  const { data: horariosRaw, error: horErr } = await admin
    .from('horarios_disponiveis')
    .select('dia_semana, hora_inicio, hora_fim')
    .eq('profissional_id', ctx.profissionalId)
    .eq('ativo', true)
    .order('dia_semana', { ascending: true })
    .order('hora_inicio', { ascending: true });
  if (horErr) return { ok: false, error: horErr.message };

  const { data: procsRaw, error: procErr } = await admin
    .from('procedimentos')
    .select('id, nome, duracao_min, valor, ativo')
    .eq('tenant_id', ctx.tenantId)
    .order('nome', { ascending: true });
  if (procErr) return { ok: false, error: procErr.message };

  const horarios: HorarioBloco[] = (horariosRaw ?? []).map((h) => ({
    dia_semana: h.dia_semana as number,
    hora_inicio: (h.hora_inicio as string).slice(0, 5),
    hora_fim: (h.hora_fim as string).slice(0, 5),
  }));

  const procedimentos: Procedimento[] = (procsRaw ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
    duracao_min: p.duracao_min as number,
    valor: p.valor === null || p.valor === undefined ? null : Number(p.valor),
    ativo: Boolean(p.ativo),
  }));

  return {
    ok: true,
    data: {
      profissional: {
        id: prof.id as string,
        tenant_id: prof.tenant_id as string,
        nome: prof.nome as string,
        especialidade: prof.especialidade as string,
        registro_profissional: (prof.registro_profissional as string | null) ?? null,
        email: prof.email as string,
        telefone: (prof.telefone as string | null) ?? null,
        bio: (prof.bio as string | null) ?? null,
        role: prof.role as string,
        assinatura_tipo: (prof.assinatura_tipo as AssinaturaTipo | null) ?? null,
        assinatura_fonte: (prof.assinatura_fonte as string | null) ?? null,
        assinatura_url: (prof.assinatura_url as string | null) ?? null,
        logo_url: (prof.logo_url as string | null) ?? null,
        enviar_avaliacao:
          (prof.enviar_avaliacao as boolean | null) === false ? false : true,
        enviar_followup:
          (prof.enviar_followup as boolean | null) === false ? false : true,
        mostrar_acompanhamento:
          (prof.mostrar_acompanhamento as boolean | null) === false
            ? false
            : true,
        followup_mensagem: (prof.followup_mensagem as string | null) ?? null,
        intervalo_entre_consultas_min:
          (prof.intervalo_entre_consultas_min as number | null) ?? 0,
      },
      tenant: {
        id: tenant.id as string,
        nome_empresa: tenant.nome_empresa as string,
        slug: tenant.slug as string,
        telefone: (tenant.telefone as string | null) ?? null,
        email: (tenant.email as string | null) ?? null,
        endereco: (tenant.endereco as string | null) ?? null,
        cidade: (tenant.cidade as string | null) ?? null,
        estado: (tenant.estado as string | null) ?? null,
        plano: (tenant.plano as string | null) ?? 'trial',
        trial_expira_em:
          (tenant.trial_expira_em as string | null) ?? null,
      },
      horarios,
      procedimentos,
    },
  };
}

export type AtualizarProfissionalInput = {
  nome: string;
  especialidade: string;
  registro_profissional?: string;
  telefone: string;
  bio?: string;
  intervalo_entre_consultas_min?: number;
};

const INTERVALOS_VALIDOS = [0, 5, 10, 15, 20, 30] as const;

export async function atualizarProfissional(
  input: AtualizarProfissionalInput,
): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 3) return { ok: false, error: 'Nome invalido.' };

  const especialidade = input.especialidade?.trim() ?? '';
  if (especialidade.length < 2) {
    return { ok: false, error: 'Selecione uma especialidade.' };
  }

  const telefone = cleanPhone(input.telefone ?? '');
  if (telefone.length !== 10 && telefone.length !== 11) {
    return { ok: false, error: 'Telefone invalido.' };
  }

  const bio = input.bio?.trim() ?? '';
  if (bio.length > 300) return { ok: false, error: 'Bio acima de 300 caracteres.' };

  const intervalo =
    typeof input.intervalo_entre_consultas_min === 'number'
      ? Math.round(input.intervalo_entre_consultas_min)
      : 0;
  if (
    !INTERVALOS_VALIDOS.includes(
      intervalo as (typeof INTERVALOS_VALIDOS)[number],
    )
  ) {
    return { ok: false, error: 'Intervalo entre consultas invalido.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profissionais')
    .update({
      nome,
      especialidade,
      registro_profissional: input.registro_profissional?.trim() || null,
      telefone,
      bio: bio || null,
      intervalo_entre_consultas_min: intervalo,
    })
    .eq('id', ctx.profissionalId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

const FONTES_VALIDAS: AssinaturaFonte[] = [
  'Dancing Script',
  'Great Vibes',
  'Pacifico',
];

const ASSINATURA_BUCKET = 'assinaturas';
const MAX_ASSINATURA_BYTES = 500 * 1024;
const TIPOS_IMAGEM_VALIDOS = ['image/png', 'image/jpeg', 'image/jpg'];

export async function salvarAssinatura(
  formData: FormData,
): Promise<Result<{ tipo: AssinaturaTipo; fonte: string | null; url: string | null }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const tipo = formData.get('tipo');
  if (tipo !== 'fonte' && tipo !== 'imagem') {
    return { ok: false, error: 'Tipo de assinatura invalido.' };
  }

  const admin = createAdminClient();

  if (tipo === 'fonte') {
    const fonteRaw = (formData.get('fonte') as string | null)?.trim() ?? '';
    if (!FONTES_VALIDAS.includes(fonteRaw as AssinaturaFonte)) {
      return { ok: false, error: 'Fonte invalida.' };
    }

    const { error } = await admin
      .from('profissionais')
      .update({
        assinatura_tipo: 'fonte',
        assinatura_fonte: fonteRaw,
        assinatura_url: null,
      })
      .eq('id', ctx.profissionalId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/configuracoes');
    return {
      ok: true,
      data: { tipo: 'fonte', fonte: fonteRaw, url: null },
    };
  }

  // tipo === 'imagem'
  const arquivo = formData.get('arquivo');
  const usarExistente = formData.get('usarExistente') === 'true';

  if (usarExistente) {
    // Mantem URL atual e apenas troca o tipo se necessario
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('assinatura_url')
      .eq('id', ctx.profissionalId)
      .maybeSingle();
    if (profErr) return { ok: false, error: profErr.message };
    const urlAtual = (prof?.assinatura_url as string | null) ?? null;
    if (!urlAtual) {
      return { ok: false, error: 'Envie uma imagem de assinatura.' };
    }
    const { error } = await admin
      .from('profissionais')
      .update({
        assinatura_tipo: 'imagem',
        assinatura_fonte: null,
      })
      .eq('id', ctx.profissionalId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/configuracoes');
    return { ok: true, data: { tipo: 'imagem', fonte: null, url: urlAtual } };
  }

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: 'Arquivo de assinatura obrigatorio.' };
  }
  if (arquivo.size > MAX_ASSINATURA_BYTES) {
    return { ok: false, error: 'Imagem acima de 500KB.' };
  }
  if (!TIPOS_IMAGEM_VALIDOS.includes(arquivo.type)) {
    return { ok: false, error: 'Use PNG ou JPG.' };
  }

  const ext =
    arquivo.type === 'image/png'
      ? 'png'
      : arquivo.type === 'image/jpeg' || arquivo.type === 'image/jpg'
        ? 'jpg'
        : 'png';
  const path = `${ctx.tenantId}/${ctx.profissionalId}/assinatura-${Date.now()}.${ext}`;

  const arrayBuffer = await arquivo.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: upErr } = await admin.storage
    .from(ASSINATURA_BUCKET)
    .upload(path, bytes, {
      contentType: arquivo.type,
      upsert: true,
    });
  if (upErr) {
    return { ok: false, error: `Falha no upload: ${upErr.message}` };
  }

  const { data: pub } = admin.storage.from(ASSINATURA_BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl ?? null;
  if (!url) return { ok: false, error: 'Falha ao gerar URL publica.' };

  // Apaga URL antiga (best-effort) se existir
  try {
    const { data: profAtual } = await admin
      .from('profissionais')
      .select('assinatura_url')
      .eq('id', ctx.profissionalId)
      .maybeSingle();
    const antiga = (profAtual?.assinatura_url as string | null) ?? null;
    if (antiga) {
      const marker = `/${ASSINATURA_BUCKET}/`;
      const idx = antiga.indexOf(marker);
      if (idx !== -1) {
        const oldPath = antiga.slice(idx + marker.length);
        if (oldPath && oldPath !== path) {
          await admin.storage.from(ASSINATURA_BUCKET).remove([oldPath]);
        }
      }
    }
  } catch (e) {
    console.error('[salvarAssinatura] limpeza antiga falhou:', e);
  }

  const { error: updErr } = await admin
    .from('profissionais')
    .update({
      assinatura_tipo: 'imagem',
      assinatura_fonte: null,
      assinatura_url: url,
    })
    .eq('id', ctx.profissionalId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/configuracoes');
  return { ok: true, data: { tipo: 'imagem', fonte: null, url } };
}

// ============================================================
// LOGO DA CLINICA
// ============================================================

const LOGO_BUCKET = 'logos';
const MAX_LOGO_BYTES = 1 * 1024 * 1024;
const TIPOS_LOGO_VALIDOS = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
];

function extLogo(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/svg+xml') return 'svg';
  return 'jpg';
}

async function removerLogoStorage(
  admin: ReturnType<typeof createAdminClient>,
  url: string | null,
) {
  if (!url) return;
  // Aceita tanto o bucket atual quanto o legacy 'avatares' (logos antigas).
  const marker = url.includes(`/${LOGO_BUCKET}/`)
    ? `/${LOGO_BUCKET}/`
    : '/avatares/';
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  if (!path) return;
  const bucket = marker === '/avatares/' ? 'avatares' : LOGO_BUCKET;
  await admin.storage.from(bucket).remove([path]).catch(() => {});
}

export async function salvarLogo(
  formData: FormData,
): Promise<Result<{ url: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: 'Arquivo invalido.' };
  }
  if (arquivo.size > MAX_LOGO_BYTES) {
    return { ok: false, error: 'Logo acima de 1MB.' };
  }
  if (!TIPOS_LOGO_VALIDOS.includes(arquivo.type)) {
    return { ok: false, error: 'Use PNG, JPG ou SVG.' };
  }

  const ext = extLogo(arquivo.type);
  // Path dentro do bucket: <profissional_id>/logo-<ts>.<ext>
  // O bucket ja se chama "logos", portanto NAO prefixar logos/ aqui.
  const path = `${ctx.profissionalId}/logo-${Date.now()}.${ext}`;

  console.log('[salvarLogo] upload', {
    bucket: LOGO_BUCKET,
    path,
    mime: arquivo.type,
    bytes: arquivo.size,
  });

  const buffer = new Uint8Array(await arquivo.arrayBuffer());
  const admin = createAdminClient();

  const { error: upErr } = await admin.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, {
      contentType: arquivo.type,
      upsert: true,
    });
  if (upErr) {
    console.error('[salvarLogo] erro no upload:', upErr.message);
    return { ok: false, error: `Falha no upload: ${upErr.message}` };
  }

  const { data: pub } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl ?? null;
  console.log('[salvarLogo] URL publica gerada:', url);
  if (!url) return { ok: false, error: 'Falha ao gerar URL publica.' };

  // Remove logo anterior se existir
  try {
    const { data: profAtual } = await admin
      .from('profissionais')
      .select('logo_url')
      .eq('id', ctx.profissionalId)
      .maybeSingle();
    const antiga = (profAtual?.logo_url as string | null) ?? null;
    if (antiga && antiga !== url) {
      await removerLogoStorage(admin, antiga);
    }
  } catch (e) {
    console.error('[salvarLogo] limpeza antiga falhou:', e);
  }

  const { error: updErr } = await admin
    .from('profissionais')
    .update({ logo_url: url })
    .eq('id', ctx.profissionalId);
  if (updErr) {
    console.error('[salvarLogo] erro ao atualizar logo_url:', updErr.message);
    return { ok: false, error: updErr.message };
  }

  console.log('[salvarLogo] logo_url salva no banco:', url);
  revalidatePath('/configuracoes');
  return { ok: true, data: { url } };
}

export async function removerLogo(): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: profAtual, error: getErr } = await admin
    .from('profissionais')
    .select('logo_url')
    .eq('id', ctx.profissionalId)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };

  const antiga = (profAtual?.logo_url as string | null) ?? null;
  if (antiga) {
    await removerLogoStorage(admin, antiga);
  }

  const { error: updErr } = await admin
    .from('profissionais')
    .update({ logo_url: null })
    .eq('id', ctx.profissionalId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

export type AtualizarTenantInput = {
  nome_empresa: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
};

export async function atualizarTenant(
  input: AtualizarTenantInput,
): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem editar a clinica.' };
  }

  const nome = input.nome_empresa?.trim() ?? '';
  if (nome.length < 3) return { ok: false, error: 'Nome da empresa invalido.' };

  let telefone: string | null = null;
  if (input.telefone) {
    const digits = cleanPhone(input.telefone);
    if (digits.length !== 0 && digits.length !== 10 && digits.length !== 11) {
      return { ok: false, error: 'Telefone invalido.' };
    }
    telefone = digits || null;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenants')
    .update({
      nome_empresa: nome,
      telefone,
      cidade: input.cidade?.trim() || null,
      estado: input.estado?.trim() || null,
    })
    .eq('id', ctx.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

export async function salvarHorarios(
  blocos: HorarioBloco[],
): Promise<Result<null>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  for (const b of blocos) {
    if (!Number.isInteger(b.dia_semana) || b.dia_semana < 0 || b.dia_semana > 6) {
      return { ok: false, error: 'Dia da semana invalido.' };
    }
    if (!/^\d{2}:\d{2}$/.test(b.hora_inicio) || !/^\d{2}:\d{2}$/.test(b.hora_fim)) {
      return { ok: false, error: 'Horario invalido.' };
    }
    if (b.hora_inicio >= b.hora_fim) {
      return { ok: false, error: 'Hora de fim deve ser maior que a de inicio.' };
    }
  }

  const admin = createAdminClient();

  const { error: delErr } = await admin
    .from('horarios_disponiveis')
    .delete()
    .eq('profissional_id', ctx.profissionalId);
  if (delErr) return { ok: false, error: delErr.message };

  if (blocos.length > 0) {
    const rows = blocos.map((b) => ({
      profissional_id: ctx.profissionalId,
      dia_semana: b.dia_semana,
      hora_inicio: `${b.hora_inicio}:00`,
      hora_fim: `${b.hora_fim}:00`,
      ativo: true,
    }));
    const { error: insErr } = await admin.from('horarios_disponiveis').insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

export type ProcedimentoInput = {
  nome: string;
  duracao_min: number;
  valor?: number | null;
};

export async function criarProcedimento(
  input: ProcedimentoInput,
): Promise<Result<{ id: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 2) return { ok: false, error: 'Nome obrigatorio.' };
  if (
    !Number.isFinite(input.duracao_min) ||
    input.duracao_min <= 0 ||
    input.duracao_min > 600
  ) {
    return { ok: false, error: 'Duracao invalida.' };
  }
  const valor =
    input.valor === null || input.valor === undefined
      ? null
      : Number.isFinite(input.valor) && input.valor >= 0
        ? input.valor
        : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('procedimentos')
    .insert({
      tenant_id: ctx.tenantId,
      profissional_id: ctx.profissionalId,
      nome,
      duracao_min: Math.round(input.duracao_min),
      valor,
      ativo: true,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao salvar.' };
  }

  revalidatePath('/configuracoes');
  return { ok: true, data: { id: data.id as string } };
}

export async function atualizarProcedimento(
  id: string,
  input: ProcedimentoInput,
): Promise<Result<null>> {
  if (!id) return { ok: false, error: 'Procedimento invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const nome = input.nome?.trim() ?? '';
  if (nome.length < 2) return { ok: false, error: 'Nome obrigatorio.' };
  if (
    !Number.isFinite(input.duracao_min) ||
    input.duracao_min <= 0 ||
    input.duracao_min > 600
  ) {
    return { ok: false, error: 'Duracao invalida.' };
  }
  const valor =
    input.valor === null || input.valor === undefined
      ? null
      : Number.isFinite(input.valor) && input.valor >= 0
        ? input.valor
        : null;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('procedimentos')
    .select('id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Procedimento nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { error } = await admin
    .from('procedimentos')
    .update({
      nome,
      duracao_min: Math.round(input.duracao_min),
      valor,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

export async function toggleProcedimento(
  id: string,
  ativo: boolean,
): Promise<Result<null>> {
  if (!id) return { ok: false, error: 'Procedimento invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('procedimentos')
    .select('id, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Procedimento nao encontrado.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { error } = await admin
    .from('procedimentos')
    .update({ ativo })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}
