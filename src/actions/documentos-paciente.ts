'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export type CategoriaDocumento =
  | 'foto'
  | 'exame'
  | 'laudo'
  | 'receita'
  | 'outro';

export type DocumentoPaciente = {
  id: string;
  paciente_id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tamanho_bytes: number;
  storage_path: string;
  categoria: CategoriaDocumento;
  descricao: string | null;
  created_at: string;
};

const CATEGORIAS_VALIDAS: CategoriaDocumento[] = [
  'foto',
  'exame',
  'laudo',
  'receita',
  'outro',
];

const BUCKET = 'documentos-pacientes';
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS_VALIDOS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

function extensaoPorMime(mime: string, fallbackNome: string): string {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'application/pdf':
      return 'pdf';
    default: {
      const m = fallbackNome.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
      return m ? m[1] : 'bin';
    }
  }
}

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
  const { data: prof, error } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: prof.tenant_id as string,
    profissionalId: prof.id as string,
  };
}

async function checarPaciente(
  admin: ReturnType<typeof createAdminClient>,
  pacienteId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: pac, error } = await admin
    .from('pacientes')
    .select('id, tenant_id')
    .eq('id', pacienteId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!pac) return { ok: false, error: 'Paciente nao encontrado.' };
  if (pac.tenant_id !== tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }
  return { ok: true };
}

export type UploadDocumentoResult =
  | { ok: true; documento: DocumentoPaciente }
  | { ok: false; error: string };

export async function uploadDocumento(
  pacienteId: string,
  arquivo: File,
  categoria: CategoriaDocumento,
  descricao?: string,
): Promise<UploadDocumentoResult> {
  if (!pacienteId) return { ok: false, error: 'Paciente invalido.' };
  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return { ok: false, error: 'Categoria invalida.' };
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, error: 'Arquivo invalido.' };
  }
  if (arquivo.size > MAX_BYTES) {
    return { ok: false, error: 'Arquivo acima de 10MB.' };
  }
  if (!TIPOS_VALIDOS.includes(arquivo.type)) {
    return {
      ok: false,
      error: 'Tipo invalido. Use JPG, PNG, WebP, HEIC ou PDF.',
    };
  }

  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();

  const checked = await checarPaciente(admin, pacienteId, ctx.tenantId);
  if (!checked.ok) return checked;

  const ext = extensaoPorMime(arquivo.type, arquivo.name);
  const id = crypto.randomUUID();
  const path = `${ctx.tenantId}/${pacienteId}/${id}.${ext}`;
  const buffer = new Uint8Array(await arquivo.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: arquivo.type,
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Falha no upload: ${upErr.message}` };
  }

  const descricaoLimpa = descricao?.trim() || null;
  if (descricaoLimpa && descricaoLimpa.length > 500) {
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: 'Descricao acima de 500 caracteres.' };
  }

  const nomeOriginal = (arquivo.name || `${id}.${ext}`).slice(0, 200);

  const { data: row, error: insErr } = await admin
    .from('documentos_paciente')
    .insert({
      tenant_id: ctx.tenantId,
      paciente_id: pacienteId,
      profissional_id: ctx.profissionalId,
      nome_arquivo: nomeOriginal,
      tipo_arquivo: arquivo.type,
      tamanho_bytes: arquivo.size,
      storage_path: path,
      categoria,
      descricao: descricaoLimpa,
    })
    .select(
      'id, paciente_id, nome_arquivo, tipo_arquivo, tamanho_bytes, storage_path, categoria, descricao, created_at',
    )
    .single();
  if (insErr || !row) {
    await admin.storage.from(BUCKET).remove([path]);
    return {
      ok: false,
      error: insErr?.message ?? 'Falha ao registrar documento.',
    };
  }

  revalidatePath(`/pacientes/${pacienteId}`);

  return {
    ok: true,
    documento: {
      id: row.id as string,
      paciente_id: row.paciente_id as string,
      nome_arquivo: row.nome_arquivo as string,
      tipo_arquivo: row.tipo_arquivo as string,
      tamanho_bytes: row.tamanho_bytes as number,
      storage_path: row.storage_path as string,
      categoria: row.categoria as CategoriaDocumento,
      descricao: (row.descricao as string | null) ?? null,
      created_at: row.created_at as string,
    },
  };
}

export type GetDocumentosResult =
  | { ok: true; documentos: DocumentoPaciente[] }
  | { ok: false; error: string };

export async function getDocumentos(
  pacienteId: string,
): Promise<GetDocumentosResult> {
  if (!pacienteId) return { ok: false, error: 'Paciente invalido.' };

  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const checked = await checarPaciente(admin, pacienteId, ctx.tenantId);
  if (!checked.ok) return checked;

  const { data, error } = await admin
    .from('documentos_paciente')
    .select(
      'id, paciente_id, nome_arquivo, tipo_arquivo, tamanho_bytes, storage_path, categoria, descricao, created_at',
    )
    .eq('paciente_id', pacienteId)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };

  const documentos: DocumentoPaciente[] = (data ?? []).map((r) => ({
    id: r.id as string,
    paciente_id: r.paciente_id as string,
    nome_arquivo: r.nome_arquivo as string,
    tipo_arquivo: r.tipo_arquivo as string,
    tamanho_bytes: r.tamanho_bytes as number,
    storage_path: r.storage_path as string,
    categoria: r.categoria as CategoriaDocumento,
    descricao: (r.descricao as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  return { ok: true, documentos };
}

export async function getUrlDocumento(
  documentoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!documentoId) return { ok: false, error: 'Documento invalido.' };

  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: doc, error } = await admin
    .from('documentos_paciente')
    .select('id, tenant_id, storage_path')
    .eq('id', documentoId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!doc) return { ok: false, error: 'Documento nao encontrado.' };
  if (doc.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path as string, 60 * 60); // 1h
  if (signErr || !signed?.signedUrl) {
    return {
      ok: false,
      error: signErr?.message ?? 'Falha ao gerar URL.',
    };
  }
  return { ok: true, url: signed.signedUrl };
}

export async function excluirDocumento(
  documentoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!documentoId) return { ok: false, error: 'Documento invalido.' };

  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;

  const admin = createAdminClient();
  const { data: doc, error } = await admin
    .from('documentos_paciente')
    .select('id, tenant_id, paciente_id, storage_path')
    .eq('id', documentoId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!doc) return { ok: false, error: 'Documento nao encontrado.' };
  if (doc.tenant_id !== ctx.tenantId) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const path = doc.storage_path as string;
  const pacienteId = doc.paciente_id as string;

  const { error: delErr } = await admin
    .from('documentos_paciente')
    .delete()
    .eq('id', documentoId);
  if (delErr) return { ok: false, error: delErr.message };

  if (path) {
    await admin.storage.from(BUCKET).remove([path]).catch(() => {});
  }

  revalidatePath(`/pacientes/${pacienteId}`);
  return { ok: true };
}
