import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024;
const ACEITOS = new Set([
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type CampoTipo =
  | 'texto_livre'
  | 'selecao_multipla'
  | 'sim_nao'
  | 'escala_numerica'
  | 'data'
  | 'upload_foto';

const TIPOS_VALIDOS: CampoTipo[] = [
  'texto_livre',
  'selecao_multipla',
  'sim_nao',
  'escala_numerica',
  'data',
  'upload_foto',
];

type CampoExtraido = {
  label: string;
  tipo: CampoTipo;
  obrigatorio: boolean;
  opcoes?: string[];
  min?: number;
  max?: number;
};

function detectarTipo(
  arquivo: File,
): 'txt' | 'pdf' | 'docx' | null {
  const tipo = arquivo.type;
  const nome = arquivo.name.toLowerCase();
  if (tipo === 'text/plain' || nome.endsWith('.txt')) return 'txt';
  if (tipo === 'application/pdf' || nome.endsWith('.pdf')) return 'pdf';
  if (
    tipo ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    nome.endsWith('.docx')
  ) {
    return 'docx';
  }
  return null;
}

async function extrairTexto(
  arquivo: File,
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  const tipo = detectarTipo(arquivo);
  if (!tipo) {
    return { ok: false, erro: 'Formato nao suportado. Use TXT, PDF ou DOCX.' };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  try {
    if (tipo === 'txt') {
      const texto = buffer.toString('utf-8');
      return { ok: true, texto };
    }
    if (tipo === 'pdf') {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return { ok: true, texto: result.text ?? '' };
      } finally {
        await parser.destroy();
      }
    }
    // docx
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return { ok: true, texto: result.value ?? '' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao processar arquivo.';
    return { ok: false, erro: `Falha ao extrair texto: ${msg}` };
  }
}

function normalizarCampos(raw: unknown): CampoExtraido[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const c = (item ?? {}) as Record<string, unknown>;
      const label = typeof c.label === 'string' ? c.label.trim() : '';
      if (!label) return null;
      const tipoRaw = typeof c.tipo === 'string' ? c.tipo : 'texto_livre';
      const tipo = (TIPOS_VALIDOS as string[]).includes(tipoRaw)
        ? (tipoRaw as CampoTipo)
        : 'texto_livre';
      const campo: CampoExtraido = {
        label,
        tipo,
        obrigatorio: Boolean(c.obrigatorio),
      };
      if (tipo === 'selecao_multipla' && Array.isArray(c.opcoes)) {
        const opcoes = (c.opcoes as unknown[])
          .map((o) => String(o).trim())
          .filter((o) => o.length > 0);
        if (opcoes.length > 0) campo.opcoes = opcoes;
      }
      if (tipo === 'escala_numerica') {
        if (typeof c.min === 'number') campo.min = c.min;
        if (typeof c.max === 'number') campo.max = c.max;
      }
      return campo;
    })
    .filter((c): c is CampoExtraido => c !== null);
}

const PROMPT_SISTEMA =
  'Voce e um assistente que analisa textos de anamnese clinica. ' +
  'Analise o texto recebido e extraia os campos como um array JSON. ' +
  'Para cada campo identifique: ' +
  '- label: nome do campo ' +
  '- tipo: um de (texto_livre, selecao_multipla, sim_nao, escala_numerica, data, upload_foto) ' +
  '- obrigatorio: true se parece essencial, false se opcional ' +
  '- opcoes: array de strings se for selecao_multipla ' +
  '- min/max: numeros se for escala_numerica ' +
  'Retorne APENAS o JSON array, sem markdown, sem explicacao.';

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { erro: 'Importacao por IA nao configurada.' },
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
    .select('id, tenant_id, especialidade')
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

  const arquivo = formData.get('arquivo');
  const nomeTemplateRaw = formData.get('nome_template');
  const nomeTemplate =
    typeof nomeTemplateRaw === 'string' ? nomeTemplateRaw.trim() : '';

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json(
      { erro: 'Arquivo obrigatorio.' },
      { status: 400 },
    );
  }
  if (arquivo.size > MAX_BYTES) {
    return NextResponse.json({ erro: 'Arquivo acima de 2MB.' }, { status: 413 });
  }

  const tipoDetectado = detectarTipo(arquivo);
  if (!tipoDetectado) {
    return NextResponse.json(
      { erro: 'Formato nao suportado. Use TXT, PDF ou DOCX.' },
      { status: 400 },
    );
  }
  if (arquivo.type && !ACEITOS.has(arquivo.type) && tipoDetectado !== 'txt') {
    // permite txt sem mime explicito; outros precisam corresponder
  }

  const extracao = await extrairTexto(arquivo);
  if (!extracao.ok) {
    return NextResponse.json({ erro: extracao.erro }, { status: 400 });
  }

  const textoLimpo = extracao.texto.replace(/\s+\n/g, '\n').trim();
  if (textoLimpo.length < 20) {
    return NextResponse.json(
      {
        erro: 'Nao foi possivel extrair texto deste arquivo.',
        texto: textoLimpo,
      },
      { status: 422 },
    );
  }

  const textoParaIa = textoLimpo.slice(0, 16000);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let respostaTexto = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            PROMPT_SISTEMA +
            ' Como o cliente exige JSON valido, retorne um objeto com chave "campos" contendo o array.',
        },
        {
          role: 'user',
          content: `Texto da anamnese:\n${textoParaIa}`,
        },
      ],
    });
    respostaTexto = completion.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro na IA.';
    return NextResponse.json(
      { erro: `Falha na IA: ${msg}`, texto: textoLimpo },
      { status: 502 },
    );
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(respostaTexto);
  } catch {
    // tenta extrair array dentro de texto bruto
    const match = respostaTexto.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // ignore
      }
    }
  }

  let campos: CampoExtraido[] = [];
  if (Array.isArray(parsed)) {
    campos = normalizarCampos(parsed);
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.campos)) {
      campos = normalizarCampos(obj.campos);
    }
  }

  if (campos.length === 0) {
    return NextResponse.json(
      {
        erro: 'A IA nao conseguiu identificar campos no documento.',
        texto: textoLimpo,
        campos: [],
      },
      { status: 422 },
    );
  }

  const nomeSugerido =
    nomeTemplate.length > 0
      ? nomeTemplate
      : `Anamnese importada - ${new Date().toLocaleDateString('pt-BR')}`;

  return NextResponse.json({
    nome_sugerido: nomeSugerido,
    especialidade_sugerida: (prof.especialidade as string | null) ?? '',
    campos,
  });
}
