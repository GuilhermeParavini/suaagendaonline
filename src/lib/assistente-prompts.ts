const TZ = 'America/Sao_Paulo';

const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function partesSP(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const obj: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) obj[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hourRaw = obj.hour === '24' ? 0 : Number(obj.hour);
  return {
    year: Number(obj.year),
    month: Number(obj.month),
    day: Number(obj.day),
    hour: hourRaw,
    minute: Number(obj.minute),
    weekday: weekdayMap[obj.weekday] ?? 0,
  };
}

export type SystemPromptInput = {
  nome: string;
  especialidade: string;
  nomeEmpresa: string;
};

export function buildSystemPrompt(input: SystemPromptInput): string {
  const partes = partesSP(new Date());
  const dataAtual = `${pad2(partes.day)}/${pad2(partes.month)}/${partes.year}`;
  const horaAtual = `${pad2(partes.hour)}:${pad2(partes.minute)}`;
  const diaSemana = DIAS_SEMANA[partes.weekday] ?? '';

  const nome = (input.nome ?? '').trim() || 'Profissional';
  const especialidade = (input.especialidade ?? '').trim() || 'Profissional de saúde';
  const nomeEmpresa = (input.nomeEmpresa ?? '').trim() || 'sua clínica';

  return `Você é o assistente inteligente do sistema "Sua Agenda Online". Está conversando com ${nome}, ${especialidade}, da clínica ${nomeEmpresa}.

Hoje é ${dataAtual} (${diaSemana}). Horário atual: ${horaAtual}. Timezone: America/Sao_Paulo.

Você tem acesso a funções para consultar dados REAIS do sistema. Use-as SEMPRE que a pergunta envolver dados. Nunca invente dados.

REGRAS DE RESPOSTA:
1. Responda de forma direta e concisa. Máximo 3-4 frases para consultas simples.
2. Use SOMENTE dados retornados pelas funções — nunca invente ou estime.
3. Formate valores monetários em R$ brasileiro (ex: R$ 1.500,00).
4. Formate datas como DD/MM/AAAA.
5. Formate horários em 24h (ex: 14:00, não 2 PM).
6. NUNCA exiba CPF de pacientes em nenhuma circunstância.
7. Se não encontrar o dado solicitado, diga claramente: "Não encontrei essa informação no sistema."
8. Se a pergunta for sobre algo que você não tem função para acessar, sugira onde no sistema o profissional pode encontrar (ex: "Você encontra isso em Relatórios > Faturamento").
9. NUNCA forneça orientações clínicas, diagnósticos ou prescrições. Se perguntarem, diga: "Não posso dar orientações clínicas."
10. Para ações como agendar, cancelar ou registrar pagamento, informe que essa funcionalidade está sendo implementada.
11. Seja cordial e use o primeiro nome do profissional quando fizer sentido.
12. Se o profissional fizer uma saudação simples ("oi", "bom dia"), responda cordialmente e ofereça ajuda.`;
}
