import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { CampoTemplate, CampoTipo } from '@/actions/anamnese';
import { calculateAge } from '@/lib/validators';
import { dataPorExtenso } from '@/lib/email-templates';

export type AnamneseImpressaoData = {
  templateNome: string;
  preenchidaEm: string;
  dataExtenso: string;
  campos: CampoTemplate[];
  dados: Record<string, unknown>;
  paciente: {
    nome: string;
    cpfMascarado: string;
    dataNascimentoBR: string;
    idade: number | null;
    genero: string;
    telefone: string;
    email: string | null;
  };
  profissional: {
    nome: string;
    especialidade: string;
    registroProfissional: string | null;
    email: string;
    telefone: string;
    logoUrl: string | null;
    assinaturaTipo: 'fonte' | 'imagem' | null;
    assinaturaFonte: string | null;
    assinaturaUrl: string | null;
  };
  clinicaNome: string;
  geradoEm: string;
};

function normalizarCampos(raw: unknown): CampoTemplate[] {
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

function mascararCPF(cpf: string | null): string {
  const d = (cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return '—';
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isoToBR(iso: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatTelefone(t: string | null): string {
  if (!t) return '—';
  const d = t.replace(/\D/g, '');
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return t;
}

const generoLabel: Record<string, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  prefiro_nao_informar: 'Prefiro não informar',
};

export async function carregarDadosAnamneseImpressao(
  anamneseId: string,
): Promise<
  { ok: true; data: AnamneseImpressaoData } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from('profissionais')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };

  const { data: anam, error: aErr } = await admin
    .from('anamneses')
    .select(
      'id, dados, created_at, tenant_id, paciente_id, profissional_id, template_id, templates_anamnese(nome, campos)',
    )
    .eq('id', anamneseId)
    .maybeSingle();
  if (aErr) return { ok: false, error: aErr.message };
  if (!anam) return { ok: false, error: 'Anamnese nao encontrada.' };
  if (anam.tenant_id !== prof.tenant_id) {
    return { ok: false, error: 'Sem permissao.' };
  }

  const tplRaw = Array.isArray(anam.templates_anamnese)
    ? anam.templates_anamnese[0]
    : anam.templates_anamnese;
  const templateNome = (tplRaw?.nome as string | null) ?? 'Anamnese';
  const campos = normalizarCampos(tplRaw?.campos);

  const { data: pac } = await admin
    .from('pacientes')
    .select('nome, cpf, data_nascimento, genero, telefone, email')
    .eq('id', anam.paciente_id as string)
    .maybeSingle();

  const { data: profissional } = await admin
    .from('profissionais')
    .select(
      'nome, especialidade, registro_profissional, email, telefone, logo_url, assinatura_tipo, assinatura_fonte, assinatura_url',
    )
    .eq('id', anam.profissional_id as string)
    .maybeSingle();

  const { data: tenant } = await admin
    .from('tenants')
    .select('nome_empresa')
    .eq('id', anam.tenant_id as string)
    .maybeSingle();

  const dataNascIso = (pac?.data_nascimento as string | null) ?? null;
  const idade = dataNascIso ? calculateAge(dataNascIso) : null;
  const createdAt = anam.created_at as string;

  const data: AnamneseImpressaoData = {
    templateNome,
    preenchidaEm: createdAt,
    dataExtenso: dataPorExtenso(createdAt.slice(0, 10)),
    campos,
    dados: (anam.dados as Record<string, unknown>) ?? {},
    paciente: {
      nome: (pac?.nome as string | null) ?? 'Paciente',
      cpfMascarado: mascararCPF((pac?.cpf as string | null) ?? null),
      dataNascimentoBR: isoToBR(dataNascIso),
      idade,
      genero: generoLabel[(pac?.genero as string) ?? ''] ?? '—',
      telefone: formatTelefone((pac?.telefone as string | null) ?? null),
      email: (pac?.email as string | null) ?? null,
    },
    profissional: {
      nome: (profissional?.nome as string | null) ?? 'Profissional',
      especialidade: (profissional?.especialidade as string | null) ?? '',
      registroProfissional:
        (profissional?.registro_profissional as string | null) ?? null,
      email: (profissional?.email as string | null) ?? '',
      telefone: formatTelefone(
        (profissional?.telefone as string | null) ?? null,
      ),
      logoUrl: (profissional?.logo_url as string | null) ?? null,
      assinaturaTipo:
        (profissional?.assinatura_tipo as 'fonte' | 'imagem' | null) ?? null,
      assinaturaFonte:
        (profissional?.assinatura_fonte as string | null) ?? null,
      assinaturaUrl: (profissional?.assinatura_url as string | null) ?? null,
    },
    clinicaNome: (tenant?.nome_empresa as string | null) ?? 'Sua Agenda Online',
    geradoEm: dataPorExtenso(new Date().toISOString().slice(0, 10)),
  };

  return { ok: true, data };
}
