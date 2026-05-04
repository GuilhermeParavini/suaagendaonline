import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { verificarLimiteTranscricaoPorTenant } from '@/actions/transcricao';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type CampoTipo =
  | 'texto_livre'
  | 'selecao_multipla'
  | 'sim_nao'
  | 'escala_numerica'
  | 'data'
  | 'upload_foto';

type CampoTpl = {
  id: string;
  label: string;
  tipo: CampoTipo;
  opcoes?: string[];
  min?: number;
  max?: number;
};

const TIPOS_VALIDOS: CampoTipo[] = [
  'texto_livre',
  'selecao_multipla',
  'sim_nao',
  'escala_numerica',
  'data',
  'upload_foto',
];

function parseCamposJson(raw: unknown): CampoTpl[] {
  if (typeof raw !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      const c = (item ?? {}) as Record<string, unknown>;
      const id = typeof c.id === 'string' ? c.id : '';
      const label = typeof c.label === 'string' ? c.label : '';
      const tipoRaw = typeof c.tipo === 'string' ? c.tipo : 'texto_livre';
      if (!id || !label) return null;
      const tipo: CampoTipo = (TIPOS_VALIDOS as string[]).includes(tipoRaw)
        ? (tipoRaw as CampoTipo)
        : 'texto_livre';
      const campo: CampoTpl = { id, label, tipo };
      if (tipo === 'selecao_multipla' && Array.isArray(c.opcoes)) {
        campo.opcoes = (c.opcoes as unknown[])
          .map((o) => String(o))
          .filter((o) => o.length > 0);
      }
      if (tipo === 'escala_numerica') {
        if (typeof c.min === 'number') campo.min = c.min;
        if (typeof c.max === 'number') campo.max = c.max;
      }
      return campo;
    })
    .filter((c): c is CampoTpl => c !== null);
}

function normalizarValor(
  campo: CampoTpl,
  valor: unknown,
): unknown | null {
  if (valor === null || valor === undefined) return null;
  switch (campo.tipo) {
    case 'texto_livre': {
      const s = typeof valor === 'string' ? valor.trim() : String(valor).trim();
      return s.length > 0 ? s : null;
    }
    case 'sim_nao': {
      if (typeof valor === 'boolean') return valor;
      if (typeof valor === 'string') {
        const v = valor.trim().toLowerCase();
        if (['sim', 'true', 'yes', 's', '1'].includes(v)) return true;
        if (['nao', 'não', 'false', 'no', 'n', '0'].includes(v)) return false;
      }
      return null;
    }
    case 'escala_numerica': {
      const n = typeof valor === 'number' ? valor : Number(valor);
      if (!Number.isFinite(n)) return null;
      const min = typeof campo.min === 'number' ? campo.min : 0;
      const max = typeof campo.max === 'number' ? campo.max : 10;
      if (n < min || n > max) return null;
      return Math.round(n);
    }
    case 'selecao_multipla': {
      const opcoes = campo.opcoes ?? [];
      if (opcoes.length === 0) return null;
      const arr = Array.isArray(valor) ? valor : [valor];
      const filtradas = arr
        .map((o) => String(o).trim())
        .filter((o) => opcoes.includes(o));
      return filtradas.length > 0 ? filtradas : null;
    }
    case 'data': {
      const s = typeof valor === 'string' ? valor.trim() : '';
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    }
    case 'upload_foto':
      return null;
    default:
      return null;
  }
}

const PROMPT_SISTEMA =
  'Voce e um assistente medico. Recebeu a transcricao de um audio de anamnese clinica. ' +
  'Preencha os campos do template com base no que foi dito. Se o profissional nao mencionou um campo, use null. ' +
  'Para campos sim_nao retorne true ou false. ' +
  'Para selecao_multipla retorne um array com as opcoes mencionadas (somente opcoes validas do template). ' +
  'Para escala_numerica retorne um numero dentro do range. ' +
  'Para texto_livre retorne o texto relevante extraido. ' +
  'Para data retorne formato AAAA-MM-DD. ' +
  'Retorne APENAS um JSON objeto onde cada chave e o id do campo e o valor e a resposta extraida ou null. Nao adicione comentarios ou markdown.';

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { erro: 'IA nao configurada.' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ erro: 'Nao autenticado.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', userResp.user.id)
    .maybeSingle();
  if (profErr || !prof) {
    return NextResponse.json(
      { erro: 'Profissional nao encontrado.' },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ erro: 'FormData invalido.' }, { status: 400 });
  }

  const audio = formData.get('audio');
  const camposRaw = formData.get('campos');
  const duracaoSegundosRaw = formData.get('duracaoSegundos');

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { erro: 'Arquivo de audio obrigatorio.' },
      { status: 400 },
    );
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ erro: 'Audio acima de 25MB.' }, { status: 413 });
  }

  const campos = parseCamposJson(camposRaw);
  if (campos.length === 0) {
    return NextResponse.json(
      { erro: 'Campos do template invalidos.' },
      { status: 400 },
    );
  }

  const duracaoSegundos = (() => {
    if (typeof duracaoSegundosRaw !== 'string') return 0;
    const n = Number(duracaoSegundosRaw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  })();

  const limite = await verificarLimiteTranscricaoPorTenant(
    admin,
    prof.tenant_id as string,
  );
  if (!limite.ok) {
    return NextResponse.json({ erro: limite.error }, { status: 500 });
  }
  if (!limite.data.permitido) {
    return NextResponse.json(
      { erro: limite.data.mensagem, uso: limite.data.uso },
      { status: 403 },
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Passo 1: transcricao
  let transcricao: string;
  try {
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: 'gpt-4o-mini-transcribe',
      language: 'pt',
      response_format: 'text',
    });
    transcricao = (typeof result === 'string' ? result : String(result)).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro na transcricao.';
    return NextResponse.json(
      { erro: `Falha ao transcrever: ${msg}` },
      { status: 502 },
    );
  }

  if (!transcricao) {
    return NextResponse.json(
      { erro: 'Nao foi possivel transcrever o audio.' },
      { status: 422 },
    );
  }

  // Registrar uso (best-effort, mesmo padrao /api/transcricao)
  try {
    const mesAno = new Date().toISOString().slice(0, 7);
    const { data: existente } = await admin
      .from('uso_transcricao')
      .select('id, segundos_usados')
      .eq('profissional_id', prof.id as string)
      .eq('mes_ano', mesAno)
      .maybeSingle();
    if (existente) {
      await admin
        .from('uso_transcricao')
        .update({
          segundos_usados:
            (existente.segundos_usados as number) + duracaoSegundos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id as string);
    } else {
      await admin.from('uso_transcricao').insert({
        tenant_id: prof.tenant_id as string,
        profissional_id: prof.id as string,
        mes_ano: mesAno,
        segundos_usados: duracaoSegundos,
      });
    }
  } catch (e) {
    console.error('[anamnese-audio] falha ao registrar uso:', e);
  }

  // Passo 2: extrair campos
  const camposParaIa = campos.map((c) => {
    const out: Record<string, unknown> = {
      id: c.id,
      label: c.label,
      tipo: c.tipo,
    };
    if (c.opcoes) out.opcoes = c.opcoes;
    if (typeof c.min === 'number') out.min = c.min;
    if (typeof c.max === 'number') out.max = c.max;
    return out;
  });

  let respostaTexto = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT_SISTEMA },
        {
          role: 'user',
          content: [
            'Campos do template (JSON):',
            JSON.stringify(camposParaIa),
            '',
            'Transcricao:',
            transcricao,
          ].join('\n'),
        },
      ],
    });
    respostaTexto = completion.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro na IA.';
    return NextResponse.json(
      { erro: `Falha na IA: ${msg}`, transcricao },
      { status: 502 },
    );
  }

  let parsed: Record<string, unknown> = {};
  try {
    const obj = JSON.parse(respostaTexto);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      parsed = obj as Record<string, unknown>;
    }
  } catch {
    // tenta extrair objeto
    const match = respostaTexto.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          parsed = obj as Record<string, unknown>;
        }
      } catch {
        // ignore
      }
    }
  }

  const camposPreenchidos: Record<string, unknown> = {};
  for (const c of campos) {
    const bruto = parsed[c.id];
    const valor = normalizarValor(c, bruto);
    if (valor !== null && valor !== undefined) {
      camposPreenchidos[c.id] = valor;
    }
  }

  return NextResponse.json({
    transcricao,
    campos: camposPreenchidos,
  });
}
