'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { enviarNotificacaoEmail } from '@/lib/notificacoes';
import { emailConviteProfissional } from '@/lib/email-templates';
import { getMaxProfissionais } from '@/lib/planos';

export type ConviteRole = 'profissional' | 'secretaria';

export type Convite = {
  id: string;
  email: string;
  nome: string;
  role: string;
  status: 'pendente' | 'aceito' | 'cancelado' | 'expirado';
  convidado_por: string | null;
  convidado_por_nome: string | null;
  expira_em: string;
  created_at: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const EXPIRACAO_DIAS = 7;
const ROLES_VALIDOS: ConviteRole[] = ['profissional', 'secretaria'];

async function obterContextoAdmin(): Promise<
  | {
      ok: true;
      tenantId: string;
      profissionalId: string;
      profissionalNome: string;
      profissionalEspecialidade: string | null;
      role: string;
    }
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
    .select('id, tenant_id, role, nome, especialidade')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: data.tenant_id as string,
    profissionalId: data.id as string,
    profissionalNome: (data.nome as string) ?? '',
    profissionalEspecialidade: (data.especialidade as string | null) ?? null,
    role: (data.role as string) ?? '',
  };
}

export async function convidarProfissional(input: {
  email: string;
  nome: string;
  role: ConviteRole;
}): Promise<Result<{ id: string }>> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem convidar.' };
  }

  const email = input.email?.trim().toLowerCase() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'E-mail invalido.' };
  }
  const nome = input.nome?.trim() ?? '';
  if (nome.length < 3) return { ok: false, error: 'Nome obrigatorio.' };
  if (!ROLES_VALIDOS.includes(input.role)) {
    return { ok: false, error: 'Funcao invalida.' };
  }

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from('tenants')
    .select('plano, nome_empresa')
    .eq('id', ctx.tenantId)
    .maybeSingle();
  const plano = (tenant?.plano as string | null) ?? 'trial';
  const max = getMaxProfissionais(plano);
  const clinicaNome =
    (tenant?.nome_empresa as string | null) ?? 'Sua clinica';

  // Conta profissionais ativos
  const { count: ativosCount } = await admin
    .from('profissionais')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true);

  // Conta convites pendentes (que ainda virariam profissionais ativos)
  const { count: pendentesCount } = await admin
    .from('convites_profissional')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'pendente');

  const total = (ativosCount ?? 0) + (pendentesCount ?? 0);
  if (total >= max) {
    return {
      ok: false,
      error: `Limite do plano atingido (${max} profissional${max === 1 ? '' : 'is'}).`,
    };
  }

  // Verifica se email ja eh profissional ativo
  const { data: existente } = await admin
    .from('profissionais')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('email', email)
    .eq('ativo', true)
    .maybeSingle();
  if (existente) {
    return { ok: false, error: 'Este e-mail ja é um profissional ativo.' };
  }

  // Verifica convite pendente
  const { data: pendente } = await admin
    .from('convites_profissional')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('email', email)
    .eq('status', 'pendente')
    .maybeSingle();
  if (pendente) {
    return { ok: false, error: 'Ja existe um convite pendente para este e-mail.' };
  }

  const token = randomUUID().replace(/-/g, '');
  const expiraEm = new Date(
    Date.now() + EXPIRACAO_DIAS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: row, error: insErr } = await admin
    .from('convites_profissional')
    .insert({
      tenant_id: ctx.tenantId,
      email,
      nome,
      role: input.role,
      convidado_por: ctx.profissionalId,
      token,
      status: 'pendente',
      expira_em: expiraEm,
    })
    .select('id')
    .single();
  if (insErr || !row) {
    return { ok: false, error: insErr?.message ?? 'Falha ao criar convite.' };
  }

  // Envia email
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const linkConvite = baseUrl
      ? `${baseUrl.replace(/\/+$/, '')}/convite/${token}`
      : `/convite/${token}`;

    const { data: profLogo } = await admin
      .from('profissionais')
      .select('logo_url')
      .eq('id', ctx.profissionalId)
      .maybeSingle();

    const tpl = emailConviteProfissional({
      conviteNome: nome,
      convidadoPorNome: ctx.profissionalNome,
      convidadoPorEspecialidade: ctx.profissionalEspecialidade,
      clinicaNome,
      role: input.role,
      linkConvite,
      expiraEmDias: EXPIRACAO_DIAS,
      logoUrl: (profLogo?.logo_url as string | null) ?? null,
    });

    await enviarNotificacaoEmail({
      tenantId: ctx.tenantId,
      agendamentoId: null,
      tipo: 'convite',
      destino: email,
      assunto: tpl.assunto,
      html: tpl.html,
    });
  } catch (e) {
    console.error('[convites] erro ao enviar email:', e);
  }

  revalidatePath('/configuracoes');
  return { ok: true, data: { id: row.id as string } };
}

export async function listarConvites(): Promise<Result<Convite[]>> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('convites_profissional')
    .select(
      'id, email, nome, role, status, convidado_por, expira_em, created_at, profissionais!convites_profissional_convidado_por_fkey(nome)',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };

  const agora = Date.now();
  const lista: Convite[] = (data ?? []).map((r) => {
    const p = Array.isArray(r.profissionais)
      ? r.profissionais[0]
      : r.profissionais;
    const expira = new Date(r.expira_em as string).getTime();
    const statusOriginal = r.status as Convite['status'];
    const status: Convite['status'] =
      statusOriginal === 'pendente' && expira < agora
        ? 'expirado'
        : statusOriginal;
    return {
      id: r.id as string,
      email: r.email as string,
      nome: r.nome as string,
      role: r.role as string,
      status,
      convidado_por: (r.convidado_por as string | null) ?? null,
      convidado_por_nome: (p?.nome as string | null) ?? null,
      expira_em: r.expira_em as string,
      created_at: r.created_at as string,
    };
  });
  return { ok: true, data: lista };
}

export async function cancelarConvite(id: string): Promise<Result<null>> {
  const ctx = await obterContextoAdmin();
  if (!ctx.ok) return ctx;
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem cancelar convites.' };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from('convites_profissional')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'pendente');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/configuracoes');
  return { ok: true, data: null };
}

// ============================================================
// Aceitar convite — usuario logado, valida pelo email
// ============================================================

export type AceitarConviteInput = { token: string };

export async function getConvitePorToken(token: string): Promise<
  | {
      ok: true;
      data: {
        id: string;
        nome: string;
        email: string;
        role: string;
        clinica: string;
        convidadoPor: string | null;
        expiraEm: string;
        status: Convite['status'];
      };
    }
  | { ok: false; error: string }
> {
  if (!token || !/^[a-zA-Z0-9]+$/.test(token)) {
    return { ok: false, error: 'Token invalido.' };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('convites_profissional')
    .select(
      'id, email, nome, role, status, expira_em, tenant_id, convidado_por, tenants(nome_empresa), profissionais!convites_profissional_convidado_por_fkey(nome)',
    )
    .eq('token', token)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Convite nao encontrado.' };

  const tenantRow = Array.isArray(data.tenants)
    ? data.tenants[0]
    : data.tenants;
  const profRow = Array.isArray(data.profissionais)
    ? data.profissionais[0]
    : data.profissionais;
  const expira = new Date(data.expira_em as string).getTime();
  const statusOriginal = data.status as Convite['status'];
  const status: Convite['status'] =
    statusOriginal === 'pendente' && expira < Date.now()
      ? 'expirado'
      : statusOriginal;

  return {
    ok: true,
    data: {
      id: data.id as string,
      nome: data.nome as string,
      email: data.email as string,
      role: data.role as string,
      clinica: (tenantRow?.nome_empresa as string | null) ?? 'Sua clinica',
      convidadoPor: (profRow?.nome as string | null) ?? null,
      expiraEm: data.expira_em as string,
      status,
    },
  };
}

export async function aceitarConvite(
  input: AceitarConviteInput,
): Promise<Result<{ tenantId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login antes de aceitar.' };
  const userEmail = (user.email ?? '').trim().toLowerCase();
  if (!userEmail) {
    return { ok: false, error: 'Sua conta nao tem email valido.' };
  }

  const admin = createAdminClient();
  const { data: convite, error: getErr } = await admin
    .from('convites_profissional')
    .select(
      'id, tenant_id, email, nome, role, status, expira_em',
    )
    .eq('token', input.token)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!convite) return { ok: false, error: 'Convite invalido.' };

  if (convite.status !== 'pendente') {
    return { ok: false, error: 'Este convite nao esta mais ativo.' };
  }
  const expira = new Date(convite.expira_em as string).getTime();
  if (expira < Date.now()) {
    return { ok: false, error: 'Este convite expirou.' };
  }
  if ((convite.email as string).trim().toLowerCase() !== userEmail) {
    return {
      ok: false,
      error: `O convite é para ${convite.email as string}. Faça login com esse email.`,
    };
  }

  const tenantId = convite.tenant_id as string;

  // Ja existe profissional para este user no tenant?
  const { data: jaProf } = await admin
    .from('profissionais')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (jaProf) {
    await admin
      .from('convites_profissional')
      .update({ status: 'aceito' })
      .eq('id', convite.id as string);
    return { ok: true, data: { tenantId } };
  }

  const { error: insErr } = await admin.from('profissionais').insert({
    tenant_id: tenantId,
    user_id: user.id,
    nome: convite.nome as string,
    especialidade: 'Outra',
    email: userEmail,
    role: convite.role as string,
    ativo: true,
  });
  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  await admin
    .from('convites_profissional')
    .update({ status: 'aceito' })
    .eq('id', convite.id as string);

  revalidatePath('/');
  revalidatePath('/configuracoes');
  return { ok: true, data: { tenantId } };
}
