'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export type Evolucao = {
  id: string;
  tenant_id: string;
  paciente_id: string;
  profissional_id: string;
  agendamento_id: string | null;
  anamnese_id: string | null;
  texto: string | null;
  audio_url: string | null;
  transcricao: string | null;
  receita: string | null;
  diagnostico: string | null;
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

function mapRow(row: Record<string, unknown>): Evolucao {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    paciente_id: row.paciente_id as string,
    profissional_id: row.profissional_id as string,
    agendamento_id: (row.agendamento_id as string | null) ?? null,
    anamnese_id: (row.anamnese_id as string | null) ?? null,
    texto: (row.texto as string | null) ?? null,
    audio_url: (row.audio_url as string | null) ?? null,
    transcricao: (row.transcricao as string | null) ?? null,
    receita: (row.receita as string | null) ?? null,
    diagnostico: (row.diagnostico as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export type CriarEvolucaoInput = {
  pacienteId: string;
  agendamentoId?: string;
  anamneseId?: string;
  texto?: string;
  audioUrl?: string;
  transcricao?: string;
  receita?: string;
  diagnostico?: string;
};

export async function criarEvolucao(
  input: CriarEvolucaoInput,
): Promise<Result<{ id: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  if (!input.pacienteId) {
    return { ok: false, error: 'Paciente obrigatorio.' };
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
    .from('evolucoes')
    .insert({
      tenant_id: ctx.tenantId,
      paciente_id: input.pacienteId,
      profissional_id: ctx.profissionalId,
      agendamento_id: input.agendamentoId ?? null,
      anamnese_id: input.anamneseId ?? null,
      texto: input.texto?.trim() || null,
      audio_url: input.audioUrl ?? null,
      transcricao: input.transcricao?.trim() || null,
      receita: input.receita?.trim() || null,
      diagnostico: input.diagnostico?.trim() || null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao salvar evolucao.' };
  }

  revalidatePath(`/pacientes/${input.pacienteId}`);
  return { ok: true, data: { id: data.id as string } };
}

export type AtualizarEvolucaoInput = Partial<{
  texto: string | null;
  audioUrl: string | null;
  transcricao: string | null;
  receita: string | null;
  diagnostico: string | null;
}>;

export async function atualizarEvolucao(
  id: string,
  input: AtualizarEvolucaoInput,
): Promise<Result<null>> {
  if (!id) return { ok: false, error: 'Evolucao invalida.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: row, error: getErr } = await admin
    .from('evolucoes')
    .select('id, tenant_id, paciente_id')
    .eq('id', id)
    .maybeSingle();
  if (getErr) return { ok: false, error: getErr.message };
  if (!row) return { ok: false, error: 'Evolucao nao encontrada.' };
  if (row.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const update: Record<string, unknown> = {};
  if (input.texto !== undefined) {
    update.texto = input.texto?.trim() || null;
  }
  if (input.audioUrl !== undefined) update.audio_url = input.audioUrl ?? null;
  if (input.transcricao !== undefined) {
    update.transcricao = input.transcricao?.trim() || null;
  }
  if (input.receita !== undefined) {
    update.receita = input.receita?.trim() || null;
  }
  if (input.diagnostico !== undefined) {
    update.diagnostico = input.diagnostico?.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, data: null };
  }

  const { error } = await admin
    .from('evolucoes')
    .update(update)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pacientes/${row.paciente_id}`);
  return { ok: true, data: null };
}

export async function getEvolucoes(
  pacienteId: string,
  limit?: number,
): Promise<Result<Evolucao[]>> {
  if (!pacienteId) return { ok: false, error: 'Paciente invalido.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  let query = admin
    .from('evolucoes')
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false });
  if (typeof limit === 'number' && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((r) => mapRow(r)) };
}

export async function getEvolucao(id: string): Promise<Result<Evolucao>> {
  if (!id) return { ok: false, error: 'Evolucao invalida.' };
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('evolucoes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Evolucao nao encontrada.' };
  if (data.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  return { ok: true, data: mapRow(data) };
}

const AUDIO_BUCKET = 'audios-evolucoes';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function uploadAudioEvolucao(
  formData: FormData,
): Promise<Result<{ url: string; path: string }>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const arquivo = formData.get('arquivo');
  const pacienteId = formData.get('pacienteId');
  if (typeof pacienteId !== 'string' || !pacienteId) {
    return { ok: false, error: 'Paciente obrigatorio.' };
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: 'Arquivo invalido.' };
  }
  if (arquivo.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: 'Audio acima de 25MB.' };
  }

  const admin = createAdminClient();
  const ext =
    arquivo.type.includes('webm')
      ? 'webm'
      : arquivo.type.includes('mp4')
        ? 'mp4'
        : arquivo.type.includes('mpeg')
          ? 'mp3'
          : 'webm';
  const path = `${ctx.tenantId}/${pacienteId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const buffer = new Uint8Array(await arquivo.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(AUDIO_BUCKET)
    .upload(path, buffer, {
      contentType: arquivo.type || 'audio/webm',
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Falha no upload: ${upErr.message}` };
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 ano
  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: 'Falha ao gerar URL do audio.' };
  }

  return { ok: true, data: { url: signed.signedUrl, path } };
}
