import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { erro: 'Transcricao nao configurada' },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ erro: 'Nao autenticado' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', userResp.user.id)
    .maybeSingle();
  if (profErr || !prof) {
    return NextResponse.json(
      { erro: 'Profissional nao encontrado' },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ erro: 'FormData invalido' }, { status: 400 });
  }

  const audio = formData.get('audio');
  const duracaoSegundosRaw = formData.get('duracaoSegundos');
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { erro: 'Arquivo de audio obrigatorio' },
      { status: 400 },
    );
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { erro: 'Audio acima de 25MB' },
      { status: 413 },
    );
  }

  const duracaoSegundos = (() => {
    if (typeof duracaoSegundosRaw !== 'string') return 0;
    const n = Number(duracaoSegundosRaw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  })();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let texto: string;
  try {
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'text',
    });
    texto = typeof result === 'string' ? result : String(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro na transcricao';
    return NextResponse.json(
      { erro: `Falha ao transcrever: ${msg}` },
      { status: 502 },
    );
  }

  // Registra uso (best-effort)
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
    console.error('[transcricao] falha ao registrar uso:', e);
  }

  return NextResponse.json({ texto });
}
