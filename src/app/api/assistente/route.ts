import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  assistenteExecutors,
  assistenteTools,
  type AssistenteCtx,
} from '@/lib/assistente-functions';
import { buildSystemPrompt } from '@/lib/assistente-prompts';
import { getLimiteAssistente } from '@/lib/planos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const RESPOSTA_ERRO_AMIGAVEL = {
  resposta:
    'Desculpe, tive um problema ao processar sua pergunta. Tente novamente em alguns instantes.',
  intencao: 'erro',
  funcoes: [] as string[],
};

type CorpoRequisicao = {
  pergunta?: unknown;
  profissional_id?: unknown;
  pagina_atual?: unknown;
  origem?: unknown;
  card_id?: unknown;
};

function mesAnoAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

type Admin = ReturnType<typeof createAdminClient>;

async function registrarUso(params: {
  admin: Admin;
  tenantId: string;
  profissionalId: string;
  tokensInput: number;
  tokensOutput: number;
}): Promise<void> {
  const { admin, tenantId, profissionalId, tokensInput, tokensOutput } = params;
  const mesAno = mesAnoAtual();

  const { data: existente } = await admin
    .from('uso_assistente')
    .select('id, perguntas_usadas, tokens_input, tokens_output')
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('tipo', 'profissional')
    .eq('mes_ano', mesAno)
    .maybeSingle();

  if (existente) {
    await admin
      .from('uso_assistente')
      .update({
        perguntas_usadas:
          (Number(existente.perguntas_usadas) || 0) + 1,
        tokens_input:
          (Number(existente.tokens_input) || 0) + tokensInput,
        tokens_output:
          (Number(existente.tokens_output) || 0) + tokensOutput,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existente.id as string);
  } else {
    await admin.from('uso_assistente').insert({
      tenant_id: tenantId,
      profissional_id: profissionalId,
      tipo: 'profissional',
      mes_ano: mesAno,
      perguntas_usadas: 1,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
    });
  }
}

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ...RESPOSTA_ERRO_AMIGAVEL, intencao: 'nao_autenticado' },
      { status: 401 },
    );
  }

  let body: CorpoRequisicao = {};
  try {
    body = (await request.json()) as CorpoRequisicao;
  } catch {
    body = {};
  }

  const pergunta = typeof body.pergunta === 'string' ? body.pergunta.trim() : '';
  const origem =
    typeof body.origem === 'string' ? body.origem : 'input_livre';
  const cardId = typeof body.card_id === 'string' ? body.card_id : null;

  if (!pergunta) {
    return NextResponse.json({
      resposta: 'Pergunta vazia. Como posso ajudar?',
      intencao: 'sem_pergunta',
      funcoes: [],
    });
  }

  try {
    // 2. Profissional + tenant
    const admin = createAdminClient();
    const { data: prof, error: profErr } = await admin
      .from('profissionais')
      .select('id, tenant_id, nome, especialidade, role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profErr || !prof) {
      return NextResponse.json(RESPOSTA_ERRO_AMIGAVEL);
    }

    const tenantId = prof.tenant_id as string;
    const profissionalId = prof.id as string;

    const { data: tenant } = await admin
      .from('tenants')
      .select('nome_empresa, plano')
      .eq('id', tenantId)
      .maybeSingle();
    const plano = (tenant?.plano as string | null) ?? 'trial';
    const nomeEmpresa = (tenant?.nome_empresa as string | null) ?? 'sua clínica';

    // 3. Limite por plano
    const limite = getLimiteAssistente(plano);
    if (limite <= 0) {
      return NextResponse.json({
        erro: 'plano_sem_assistente',
        mensagem:
          'O assistente IA não está disponível no plano Essencial. Faça upgrade para o plano Profissional.',
      });
    }

    const { data: usoAtual } = await admin
      .from('uso_assistente')
      .select('perguntas_usadas')
      .eq('tenant_id', tenantId)
      .eq('profissional_id', profissionalId)
      .eq('tipo', 'profissional')
      .eq('mes_ano', mesAnoAtual())
      .maybeSingle();
    const perguntasUsadas = Number(usoAtual?.perguntas_usadas ?? 0);
    if (perguntasUsadas >= limite) {
      return NextResponse.json({
        erro: 'limite_atingido',
        mensagem: `Você atingiu o limite de ${limite} perguntas do seu plano este mês.`,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(RESPOSTA_ERRO_AMIGAVEL);
    }

    // 4. Tempo
    const inicio = Date.now();

    // 5. System prompt
    const systemPrompt = buildSystemPrompt({
      nome: (prof.nome as string | null) ?? '',
      especialidade: (prof.especialidade as string | null) ?? '',
      nomeEmpresa,
    });

    const ctx: AssistenteCtx = { tenantId, profissionalId };
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 6. Primeira chamada
    type ChatMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
    const messages: ChatMsg[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: pergunta },
    ];

    const primeira = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: assistenteTools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1000,
    });

    let totalInputTokens = primeira.usage?.prompt_tokens ?? 0;
    let totalOutputTokens = primeira.usage?.completion_tokens ?? 0;

    const respostaInicial = primeira.choices[0]?.message;
    const toolCalls = respostaInicial?.tool_calls ?? [];

    let textoFinal: string;
    let funcoesChamadas: string[] = [];
    let intencao: string;

    // 7. Há tool_calls → executar funções e fazer 2ª chamada
    if (toolCalls.length > 0 && respostaInicial) {
      funcoesChamadas = toolCalls
        .map((tc) =>
          tc.type === 'function' ? tc.function.name : null,
        )
        .filter((n): n is string => !!n);
      intencao = funcoesChamadas[0] ?? 'conversa_livre';

      const resultados = await Promise.all(
        toolCalls.map(async (tc) => {
          if (tc.type !== 'function') {
            return { tool_call_id: tc.id, content: '' };
          }
          const fn = assistenteExecutors[tc.function.name];
          if (!fn) {
            return {
              tool_call_id: tc.id,
              content: `Função ${tc.function.name} não disponível.`,
            };
          }
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}') as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }
          try {
            const out = await fn(args, ctx);
            return { tool_call_id: tc.id, content: out };
          } catch (e) {
            return {
              tool_call_id: tc.id,
              content: `Erro ao executar ${tc.function.name}: ${
                e instanceof Error ? e.message : String(e)
              }`,
            };
          }
        }),
      );

      const messagesSegunda: ChatMsg[] = [
        ...messages,
        respostaInicial as unknown as ChatMsg,
        ...resultados.map(
          (r): ChatMsg => ({
            role: 'tool',
            tool_call_id: r.tool_call_id,
            content: r.content,
          }),
        ),
      ];

      const segunda = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messagesSegunda,
        temperature: 0.3,
        max_tokens: 1000,
      });

      totalInputTokens += segunda.usage?.prompt_tokens ?? 0;
      totalOutputTokens += segunda.usage?.completion_tokens ?? 0;

      textoFinal =
        segunda.choices[0]?.message?.content?.trim() ??
        'Não consegui formular uma resposta.';
    } else {
      // 8. Conversa livre / sem tool calls
      intencao = 'conversa_livre';
      textoFinal =
        respostaInicial?.content?.trim() ?? 'Como posso ajudar?';
    }

    // 9. Tempo
    const tempoMs = Date.now() - inicio;

    // 10a. Insere histórico (aguardamos para devolver historico_id)
    let historicoId: string | null = null;
    try {
      const { data: histRow, error: histErr } = await admin
        .from('historico_assistente')
        .insert({
          tenant_id: tenantId,
          profissional_id: profissionalId,
          tipo: 'profissional',
          pergunta,
          resposta: textoFinal,
          intencao_detectada: intencao,
          funcoes_chamadas: funcoesChamadas,
          tokens_input: totalInputTokens,
          tokens_output: totalOutputTokens,
          tempo_resposta_ms: tempoMs,
          origem,
          card_id: cardId,
        })
        .select('id')
        .single();
      if (histErr) {
        console.error(
          '[assistente] erro ao gravar historico:',
          histErr.message,
        );
      } else {
        historicoId = (histRow?.id as string | null) ?? null;
      }
    } catch (e) {
      console.error('[assistente] erro ao gravar historico:', e);
    }

    // 10b. Registra uso em background (não bloqueia retorno)
    void registrarUso({
      admin,
      tenantId,
      profissionalId,
      tokensInput: totalInputTokens,
      tokensOutput: totalOutputTokens,
    }).catch((e) => {
      console.error('[assistente] erro ao gravar uso:', e);
    });

    return NextResponse.json({
      resposta: textoFinal,
      intencao,
      funcoes: funcoesChamadas,
      historico_id: historicoId,
    });
  } catch (e) {
    console.error('[assistente] erro:', e);
    return NextResponse.json(RESPOSTA_ERRO_AMIGAVEL);
  }
}
