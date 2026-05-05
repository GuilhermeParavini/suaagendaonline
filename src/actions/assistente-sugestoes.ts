import { createAdminClient } from '@/lib/supabase/server';

export type CardSugestao = {
  id: string;
  icone: string;
  titulo: string;
  preview: string;
  pergunta_formatada: string;
  prioridade: number;
  cor_destaque?: 'amber' | 'green' | 'red' | 'teal' | 'blue';
};

export type RespostaSugestoes = {
  cards: CardSugestao[];
  saudacao: string;
};

const TZ = 'America/Sao_Paulo';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(valor || 0);
}

function partesSP(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const obj: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) obj[p.type] = p.value;
  return {
    year: Number(obj.year),
    month: Number(obj.month),
    day: Number(obj.day),
    hour: obj.hour === '24' ? 0 : Number(obj.hour),
    minute: Number(obj.minute),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoYmd(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function rangeDoDia(ymd: string): { inicio: string; fim: string } {
  return {
    inicio: `${ymd}T00:00:00-03:00`,
    fim: `${ymd}T23:59:59-03:00`,
  };
}

function rangeDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  const inicio = `${ano}-${pad2(mes)}-01T00:00:00-03:00`;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fim = `${ano}-${pad2(mes)}-${pad2(ultimo)}T23:59:59-03:00`;
  return { inicio, fim };
}

function horaSP(iso: string): string {
  const p = partesSP(new Date(iso));
  return `${p.hour}:${pad2(p.minute)}`;
}

const STATUS_VALIDOS_AGENDA = ['agendado', 'confirmado', 'em_atendimento', 'concluido'];

type Admin = ReturnType<typeof createAdminClient>;

// ============================================================
// Cards
// ============================================================

async function cardAgendaHoje(
  admin: Admin,
  tenantId: string,
  profissionalId: string,
  agora: Date,
): Promise<CardSugestao> {
  const partes = partesSP(agora);
  const ymd = isoYmd(partes);
  const { inicio, fim } = rangeDoDia(ymd);

  const [{ count }, { data: proximos }] = await Promise.all([
    admin
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('profissional_id', profissionalId)
      .gte('data_hora', inicio)
      .lte('data_hora', fim)
      .in('status', STATUS_VALIDOS_AGENDA),
    admin
      .from('agendamentos')
      .select('data_hora, pacientes(nome)')
      .eq('tenant_id', tenantId)
      .eq('profissional_id', profissionalId)
      .gte('data_hora', agora.toISOString())
      .lte('data_hora', fim)
      .in('status', STATUS_VALIDOS_AGENDA)
      .order('data_hora', { ascending: true })
      .limit(1),
  ]);

  const total = count ?? 0;
  let preview: string;
  if (total === 0) {
    preview = 'Nenhum paciente hoje';
  } else {
    const proximo = (proximos ?? [])[0];
    if (proximo) {
      const pac = Array.isArray(proximo.pacientes)
        ? proximo.pacientes[0]
        : proximo.pacientes;
      const nomeProximo = (pac?.nome as string | null)?.split(' ')[0] ?? 'Paciente';
      const horario = horaSP(proximo.data_hora as string);
      preview = `${total} ${total === 1 ? 'paciente' : 'pacientes'} • Próximo: ${nomeProximo} às ${horario}`;
    } else {
      preview = `${total} ${total === 1 ? 'paciente' : 'pacientes'} hoje`;
    }
  }

  return {
    id: 'agenda_hoje',
    icone: 'Calendar',
    titulo: 'Agenda de hoje',
    preview,
    pergunta_formatada: 'Quem tenho agendado para hoje?',
    prioridade: 8,
  };
}

async function cardAgendaAmanha(
  admin: Admin,
  tenantId: string,
  profissionalId: string,
  agora: Date,
): Promise<CardSugestao | null> {
  const hoje = partesSP(agora);
  const amanha = new Date(Date.UTC(hoje.year, hoje.month - 1, hoje.day + 1));
  const ymd = `${amanha.getUTCFullYear()}-${pad2(amanha.getUTCMonth() + 1)}-${pad2(amanha.getUTCDate())}`;
  const { inicio, fim } = rangeDoDia(ymd);

  const [{ count }, { data: primeiros }] = await Promise.all([
    admin
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('profissional_id', profissionalId)
      .gte('data_hora', inicio)
      .lte('data_hora', fim)
      .in('status', STATUS_VALIDOS_AGENDA),
    admin
      .from('agendamentos')
      .select('data_hora, pacientes(nome)')
      .eq('tenant_id', tenantId)
      .eq('profissional_id', profissionalId)
      .gte('data_hora', inicio)
      .lte('data_hora', fim)
      .in('status', STATUS_VALIDOS_AGENDA)
      .order('data_hora', { ascending: true })
      .limit(1),
  ]);

  const total = count ?? 0;
  if (total === 0) return null;

  const primeiro = (primeiros ?? [])[0];
  let preview: string;
  if (primeiro) {
    const pac = Array.isArray(primeiro.pacientes)
      ? primeiro.pacientes[0]
      : primeiro.pacientes;
    const nome = (pac?.nome as string | null)?.split(' ')[0] ?? 'Paciente';
    const horario = horaSP(primeiro.data_hora as string);
    preview = `${total} ${total === 1 ? 'paciente' : 'pacientes'}, primeiro ${nome} às ${horario}`;
  } else {
    preview = `${total} ${total === 1 ? 'paciente' : 'pacientes'} amanhã`;
  }

  return {
    id: 'agenda_amanha',
    icone: 'CalendarPlus',
    titulo: 'Agenda de amanhã',
    preview,
    pergunta_formatada: 'O que tenho agendado para amanhã?',
    prioridade: 6,
  };
}

async function cardPendenciasFinanceiras(
  admin: Admin,
  tenantId: string,
  profissionalId: string,
): Promise<CardSugestao | null> {
  const { data, error } = await admin
    .from('financeiro')
    .select('valor, paciente_id')
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('tipo', 'receita')
    .eq('pago', false);
  if (error) return null;
  const linhas = data ?? [];
  if (linhas.length === 0) return null;

  const total = linhas.reduce(
    (acc, r) => acc + (Number(r.valor) || 0),
    0,
  );
  const pacientesUnicos = new Set(
    linhas
      .map((r) => r.paciente_id as string | null)
      .filter((p): p is string => Boolean(p)),
  );
  const qtdPacientes = pacientesUnicos.size || linhas.length;

  return {
    id: 'pendencias_financeiras',
    icone: 'AlertTriangle',
    titulo: 'Pendências financeiras',
    preview: `${formatarMoeda(total)} pendente de ${qtdPacientes} ${qtdPacientes === 1 ? 'paciente' : 'pacientes'}`,
    pergunta_formatada: 'Quais pacientes estão com pagamento pendente?',
    prioridade: 9,
    cor_destaque: 'amber',
  };
}

async function cardListaEspera(
  admin: Admin,
  tenantId: string,
  profissionalId: string,
): Promise<CardSugestao | null> {
  const { count, error } = await admin
    .from('lista_espera')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('status', 'aguardando');
  if (error) return null;
  const total = count ?? 0;
  if (total === 0) return null;

  return {
    id: 'lista_espera',
    icone: 'Users',
    titulo: 'Lista de espera',
    preview: `${total} ${total === 1 ? 'pessoa aguardando' : 'pessoas aguardando'} encaixe`,
    pergunta_formatada: 'Quem está na lista de espera?',
    prioridade: 5,
  };
}

const MESES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

async function cardFaturamentoMes(
  admin: Admin,
  tenantId: string,
  profissionalId: string,
  agora: Date,
): Promise<CardSugestao | null> {
  const partes = partesSP(agora);
  const { inicio, fim } = rangeDoMes(partes.year, partes.month);

  const { data, error } = await admin
    .from('financeiro')
    .select('valor')
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('tipo', 'receita')
    .eq('pago', true)
    .gte('created_at', inicio)
    .lte('created_at', fim);
  if (error) return null;
  const total = (data ?? []).reduce(
    (acc, r) => acc + (Number(r.valor) || 0),
    0,
  );
  if (total <= 0) return null;
  const mesNome = MESES_PT[partes.month - 1] ?? '';
  return {
    id: 'faturamento_mes',
    icone: 'DollarSign',
    titulo: 'Faturamento do mês',
    preview: `Faturamento ${mesNome}: ${formatarMoeda(total)}`,
    pergunta_formatada: 'Qual o faturamento deste mês?',
    prioridade: 7,
  };
}

async function cardHistoricoPaciente(
  admin: Admin,
  tenantId: string,
  profissionalId: string,
  pacienteId: string,
): Promise<CardSugestao | null> {
  const { data: ag } = await admin
    .from('agendamentos')
    .select('data_hora, procedimentos(nome)')
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('paciente_id', pacienteId)
    .eq('status', 'concluido')
    .order('data_hora', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ag) {
    return {
      id: 'historico_paciente',
      icone: 'Calendar',
      titulo: 'Histórico do paciente',
      preview: 'Sem consultas concluídas',
      pergunta_formatada:
        'Me mostra o histórico completo deste paciente.',
      prioridade: 9,
    };
  }
  const dh = ag.data_hora as string;
  const partes = partesSP(new Date(dh));
  const dataFmt = `${pad2(partes.day)}/${pad2(partes.month)}`;
  const procRaw = Array.isArray(ag.procedimentos)
    ? ag.procedimentos[0]
    : ag.procedimentos;
  const proc = (procRaw?.nome as string | null) ?? null;
  const preview = proc
    ? `Última consulta: ${dataFmt} — ${proc}`
    : `Última consulta: ${dataFmt}`;
  return {
    id: 'historico_paciente',
    icone: 'Calendar',
    titulo: 'Histórico do paciente',
    preview,
    pergunta_formatada: 'Me mostra o histórico completo deste paciente.',
    prioridade: 9,
  };
}

async function cardUltimaAnamnese(
  admin: Admin,
  tenantId: string,
  pacienteId: string,
): Promise<CardSugestao | null> {
  const { data } = await admin
    .from('anamneses')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const partes = partesSP(new Date(data.created_at as string));
  const dataFmt = `${pad2(partes.day)}/${pad2(partes.month)}`;
  return {
    id: 'ultima_anamnese',
    icone: 'ClipboardList',
    titulo: 'Última anamnese',
    preview: `Anamnese preenchida em ${dataFmt}`,
    pergunta_formatada: 'Qual foi a última anamnese deste paciente?',
    prioridade: 8,
  };
}

async function cardFaltasHoje(
  admin: Admin,
  tenantId: string,
  profissionalId: string,
  agora: Date,
): Promise<CardSugestao | null> {
  const partes = partesSP(agora);
  const ymd = isoYmd(partes);
  const { inicio, fim } = rangeDoDia(ymd);

  const { count, error } = await admin
    .from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('profissional_id', profissionalId)
    .eq('status', 'faltou')
    .gte('data_hora', inicio)
    .lte('data_hora', fim);
  if (error) return null;
  const total = count ?? 0;
  if (total === 0) return null;
  return {
    id: 'faltas_hoje',
    icone: 'Clock',
    titulo: 'Faltas hoje',
    preview: `${total} ${total === 1 ? 'falta hoje' : 'faltas hoje'}`,
    pergunta_formatada: 'Quem faltou hoje?',
    prioridade: 8,
    cor_destaque: 'amber',
  };
}

// ============================================================
// Saudação por turno
// ============================================================

function turnoDoHora(h: number): 'manha' | 'tarde' | 'noite' {
  if (h >= 6 && h < 12) return 'manha';
  if (h >= 12 && h < 18) return 'tarde';
  return 'noite';
}

function saudacaoPorTurno(
  turno: 'manha' | 'tarde' | 'noite',
  nome: string | null,
): string {
  const primeiro = (nome ?? '').trim().split(' ')[0] ?? '';
  const base =
    turno === 'manha'
      ? 'Bom dia'
      : turno === 'tarde'
        ? 'Boa tarde'
        : 'Boa noite';
  return primeiro ? `${base}, ${primeiro}!` : `${base}!`;
}

// ============================================================
// Função principal
// ============================================================

export type SugestoesContexto = {
  pagina?: string | null;
  pacienteId?: string | null;
};

function ehUuid(v: string | null | undefined): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function getSugestoesCards(
  tenantId: string,
  profissionalId: string,
  _role: string,
  paginaAtual: string,
  profissionalNome?: string | null,
  contexto?: SugestoesContexto,
): Promise<RespostaSugestoes> {
  const admin = createAdminClient();
  const agora = new Date();
  const partes = partesSP(agora);
  const turno = turnoDoHora(partes.hour);

  const pagina = (contexto?.pagina ?? paginaAtual ?? 'dashboard').toLowerCase();
  const pacienteId = contexto?.pacienteId ?? null;

  const fns: Array<Promise<CardSugestao | null>> = [];

  // Cards por horario (sempre adicionados)
  if (turno === 'manha') {
    fns.push(
      cardAgendaHoje(admin, tenantId, profissionalId, agora),
      cardPendenciasFinanceiras(admin, tenantId, profissionalId),
      cardListaEspera(admin, tenantId, profissionalId),
      cardFaturamentoMes(admin, tenantId, profissionalId, agora),
    );
  } else if (turno === 'tarde') {
    fns.push(
      cardAgendaHoje(admin, tenantId, profissionalId, agora),
      cardFaltasHoje(admin, tenantId, profissionalId, agora),
      cardAgendaAmanha(admin, tenantId, profissionalId, agora),
      cardPendenciasFinanceiras(admin, tenantId, profissionalId),
    );
  } else {
    fns.push(
      cardFaturamentoMes(admin, tenantId, profissionalId, agora),
      cardAgendaAmanha(admin, tenantId, profissionalId, agora),
      cardPendenciasFinanceiras(admin, tenantId, profissionalId),
      cardFaltasHoje(admin, tenantId, profissionalId, agora),
    );
    // Garantir que cardAgendaHoje SEMPRE apareça, mesmo à noite
    fns.push(cardAgendaHoje(admin, tenantId, profissionalId, agora));
  }

  // Cards contextuais por pagina (adicionais — nao substituem)
  const cardsForcadosPorPagina = new Set<string>();
  if (pagina === 'pacientes' && ehUuid(pacienteId)) {
    fns.push(
      cardHistoricoPaciente(admin, tenantId, profissionalId, pacienteId),
      cardUltimaAnamnese(admin, tenantId, pacienteId),
    );
    cardsForcadosPorPagina.add('historico_paciente');
    cardsForcadosPorPagina.add('ultima_anamnese');
  } else if (pagina === 'financeiro') {
    cardsForcadosPorPagina.add('faturamento_mes');
    cardsForcadosPorPagina.add('pendencias_financeiras');
  } else if (pagina === 'agenda') {
    cardsForcadosPorPagina.add('agenda_hoje');
    cardsForcadosPorPagina.add('faltas_hoje');
  }

  const resultados = await Promise.all(fns);
  const todos = resultados
    .filter((c): c is CardSugestao => c !== null)
    .filter(
      (c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx,
    );

  // Boost de prioridade quando o card esta na pagina atual
  const boosted = todos.map((c) =>
    cardsForcadosPorPagina.has(c.id)
      ? { ...c, prioridade: c.prioridade + 100 }
      : c,
  );

  const cards = boosted.sort((a, b) => b.prioridade - a.prioridade).slice(0, 4);

  return {
    cards,
    saudacao: saudacaoPorTurno(turno, profissionalNome ?? null),
  };
}
