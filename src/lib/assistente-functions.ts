import { createAdminClient } from '@/lib/supabase/server';
import { getInfoPlano, getLimiteTranscricao } from '@/lib/planos';

export type AssistenteCtx = { tenantId: string; profissionalId: string };

const TZ = 'America/Sao_Paulo';

const STATUS_AGENDA_VALIDOS = [
  'agendado',
  'confirmado',
  'em_atendimento',
  'concluido',
  'faltou',
];

const STATUS_LABEL: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
  reagendado: 'Reagendado',
};

const FORMA_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  convenio: 'Convênio',
  transferencia: 'Transferência',
  outro: 'Outro',
};

const fmtMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function moeda(v: number): string {
  return fmtMoeda.format(Number.isFinite(v) ? v : 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
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

function ymdHoje(): string {
  const p = partesSP(new Date());
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function ymdAmanha(): string {
  const p = partesSP(new Date());
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function rangeDoDiaSP(ymd: string): { inicio: string; fim: string } {
  return {
    inicio: `${ymd}T00:00:00-03:00`,
    fim: `${ymd}T23:59:59-03:00`,
  };
}

function horaSP(iso: string): string {
  const p = partesSP(new Date(iso));
  return `${p.hour}:${pad2(p.minute)}`;
}

function ymdParaBR(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function isoDateBR(iso: string): string {
  const p = partesSP(new Date(iso));
  return `${pad2(p.day)}/${pad2(p.month)}/${p.year}`;
}

function calcularIdade(dataNascIso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataNascIso);
  if (!m) return null;
  const today = new Date();
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  let idade = today.getFullYear() - y;
  const aniv = new Date(today.getFullYear(), month - 1, d);
  if (today < aniv) idade--;
  return idade < 0 ? null : idade;
}

function formatTel(tel: string | null): string | null {
  if (!tel) return null;
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return tel;
}

function rangeDoMes(ano: number, mes: number): { inicio: string; fim: string } {
  const inicio = `${ano}-${pad2(mes)}-01T00:00:00-03:00`;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fim = `${ano}-${pad2(mes)}-${pad2(ultimo)}T23:59:59-03:00`;
  return { inicio, fim };
}

function rangeDoMesYmd(
  ano: number,
  mes: number,
): { inicio: string; fim: string } {
  const inicio = `${ano}-${pad2(mes)}-01`;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fim = `${ano}-${pad2(mes)}-${pad2(ultimo)}`;
  return { inicio, fim };
}

function inicioDaSemanaSP(): { inicio: string; fim: string } {
  const partes = partesSP(new Date());
  // Segunda-feira como início
  const d = new Date(Date.UTC(partes.year, partes.month - 1, partes.day));
  const dow = d.getUTCDay(); // 0=Dom..6=Sab
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  const inicio = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const fimDate = new Date(d);
  fimDate.setUTCDate(fimDate.getUTCDate() + 6);
  const fim = `${fimDate.getUTCFullYear()}-${pad2(fimDate.getUTCMonth() + 1)}-${pad2(fimDate.getUTCDate())}`;
  return { inicio, fim };
}

// ============================================================
// 1. agenda_hoje / 2. agenda_dia
// ============================================================

async function agendaPorData(ymd: string, ctx: AssistenteCtx): Promise<string> {
  const admin = createAdminClient();
  const { inicio, fim } = rangeDoDiaSP(ymd);
  const { data, error } = await admin
    .from('agendamentos')
    .select(
      'id, data_hora, status, pacientes(nome), procedimentos(nome, valor)',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('profissional_id', ctx.profissionalId)
    .gte('data_hora', inicio)
    .lte('data_hora', fim)
    .neq('status', 'cancelado')
    .neq('status', 'reagendado')
    .order('data_hora', { ascending: true });
  if (error) return `Erro ao consultar agenda: ${error.message}`;
  const linhas = (data ?? []).map((r) => {
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    const proc = Array.isArray(r.procedimentos)
      ? r.procedimentos[0]
      : r.procedimentos;
    const hora = horaSP(r.data_hora as string);
    const nome = (pac?.nome as string | null) ?? 'Paciente';
    const procNome = (proc?.nome as string | null) ?? null;
    const status = STATUS_LABEL[r.status as string] ?? (r.status as string);
    const partes = [`${hora} - ${nome}`];
    if (procNome) partes.push(`(${procNome})`);
    partes.push(`[${status}]`);
    return partes.join(' ');
  });
  if (linhas.length === 0) {
    return `Nenhum agendamento para ${ymdParaBR(ymd)}.`;
  }
  return `Agendamentos para ${ymdParaBR(ymd)}:\n${linhas.join('\n')}`;
}

async function agenda_hoje(
  _params: Record<string, unknown>,
  ctx: AssistenteCtx,
): Promise<string> {
  return agendaPorData(ymdHoje(), ctx);
}

async function agenda_dia(
  params: { data?: string },
  ctx: AssistenteCtx,
): Promise<string> {
  const data =
    typeof params?.data === 'string' && isYmd(params.data)
      ? params.data
      : ymdAmanha();
  return agendaPorData(data, ctx);
}

// ============================================================
// 3. buscar_paciente
// ============================================================

async function buscar_paciente(
  params: { termo?: string },
  ctx: AssistenteCtx,
): Promise<string> {
  const termo = (params?.termo ?? '').trim();
  if (termo.length < 2) {
    return 'Informe pelo menos 2 caracteres para buscar.';
  }
  const admin = createAdminClient();
  const digits = termo.replace(/\D/g, '');
  const safeNome = termo.replace(/[,()*]/g, ' ').trim();
  let query = admin
    .from('pacientes')
    .select(
      'id, nome, telefone, email, convenio, data_nascimento',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('ativo', true);
  if (digits.length >= 3) {
    query = query.or(
      `nome.ilike.*${safeNome}*,telefone.ilike.*${digits}*`,
    );
  } else {
    query = query.ilike('nome', `%${safeNome}%`);
  }
  const { data: rows, error } = await query
    .order('nome', { ascending: true })
    .limit(10);
  if (error) return `Erro ao buscar pacientes: ${error.message}`;
  if (!rows || rows.length === 0) {
    return `Nenhum paciente encontrado para "${termo}".`;
  }

  const ids = rows.map((r) => r.id as string);
  const { data: ultimas } = await admin
    .from('agendamentos')
    .select('paciente_id, data_hora')
    .eq('profissional_id', ctx.profissionalId)
    .eq('status', 'concluido')
    .in('paciente_id', ids)
    .order('data_hora', { ascending: false });
  const ultimaPorPac = new Map<string, string>();
  for (const a of ultimas ?? []) {
    const pid = a.paciente_id as string;
    if (!ultimaPorPac.has(pid)) {
      ultimaPorPac.set(pid, a.data_hora as string);
    }
  }

  const linhas = rows.map((r) => {
    const id = r.id as string;
    const idade = calcularIdade((r.data_nascimento as string) ?? '');
    const ultima = ultimaPorPac.get(id);
    const tel = formatTel((r.telefone as string | null) ?? null);
    const partes: string[] = [r.nome as string];
    if (idade !== null) partes.push(`${idade} anos`);
    if (tel) partes.push(tel);
    if (r.email) partes.push((r.email as string) ?? '');
    if (r.convenio) partes.push(`Convênio: ${r.convenio as string}`);
    if (ultima) partes.push(`Última consulta: ${isoDateBR(ultima)}`);
    else partes.push('Sem consultas concluídas');
    return `- ${partes.join(' · ')}`;
  });
  return `Encontrei ${rows.length} ${rows.length === 1 ? 'paciente' : 'pacientes'}:\n${linhas.join('\n')}`;
}

// ============================================================
// 4. financeiro_resumo
// ============================================================

function rangeDoPeriodo(periodo: string): {
  inicio: string;
  fim: string;
  rotulo: string;
} {
  const partes = partesSP(new Date());
  if (periodo === 'mes_anterior') {
    const mes = partes.month === 1 ? 12 : partes.month - 1;
    const ano = partes.month === 1 ? partes.year - 1 : partes.year;
    const r = rangeDoMesYmd(ano, mes);
    return { ...r, rotulo: 'mês anterior' };
  }
  if (periodo === 'semana') {
    const r = inicioDaSemanaSP();
    return { ...r, rotulo: 'semana' };
  }
  if (periodo === 'hoje') {
    const ymd = ymdHoje();
    return { inicio: ymd, fim: ymd, rotulo: 'hoje' };
  }
  const r = rangeDoMesYmd(partes.year, partes.month);
  return { ...r, rotulo: 'mês atual' };
}

async function financeiro_resumo(
  params: { periodo?: string },
  ctx: AssistenteCtx,
): Promise<string> {
  const { inicio, fim, rotulo } = rangeDoPeriodo(params?.periodo ?? 'mes_atual');
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('financeiro')
    .select('tipo, valor, forma_pagamento, pago')
    .eq('tenant_id', ctx.tenantId)
    .eq('profissional_id', ctx.profissionalId)
    .gte('data_lancamento', inicio)
    .lte('data_lancamento', fim);
  if (error) return `Erro ao consultar financeiro: ${error.message}`;
  let receitas = 0;
  let despesas = 0;
  const porForma = new Map<string, number>();
  for (const r of data ?? []) {
    const valor = Number(r.valor) || 0;
    if (r.tipo === 'receita' && r.pago) receitas += valor;
    if (r.tipo === 'despesa' && r.pago) despesas += valor;
    if (r.tipo === 'receita' && r.pago) {
      const f = (r.forma_pagamento as string | null) ?? 'outro';
      porForma.set(f, (porForma.get(f) ?? 0) + valor);
    }
  }
  const saldo = receitas - despesas;
  const formas = Array.from(porForma.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([f, v]) => `  ${FORMA_LABEL[f] ?? f}: ${moeda(v)}`)
    .join('\n');
  const partes = [
    `Resumo financeiro (${rotulo}):`,
    `- Receitas pagas: ${moeda(receitas)}`,
    `- Despesas pagas: ${moeda(despesas)}`,
    `- Saldo: ${moeda(saldo)}`,
  ];
  if (formas) partes.push(`Por forma de pagamento:\n${formas}`);
  return partes.join('\n');
}

// ============================================================
// 5. financeiro_pendente
// ============================================================

async function financeiro_pendente(
  _params: Record<string, unknown>,
  ctx: AssistenteCtx,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('financeiro')
    .select('id, valor, descricao, created_at, pacientes(nome)')
    .eq('tenant_id', ctx.tenantId)
    .eq('profissional_id', ctx.profissionalId)
    .eq('tipo', 'receita')
    .eq('pago', false)
    .order('valor', { ascending: false })
    .limit(20);
  if (error) return `Erro ao consultar pendências: ${error.message}`;
  if (!data || data.length === 0) {
    return 'Nenhum pagamento pendente.';
  }
  const total = data.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
  const linhas = data.map((r) => {
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    const nome = (pac?.nome as string | null) ?? 'Sem paciente';
    const valor = moeda(Number(r.valor) || 0);
    const desc = (r.descricao as string) ?? '—';
    const data = isoDateBR(r.created_at as string);
    return `- ${nome} · ${valor} · ${desc} · ${data}`;
  });
  return `Pagamentos pendentes (${data.length}, total ${moeda(total)}):\n${linhas.join('\n')}`;
}

// ============================================================
// 6. lista_espera
// ============================================================

async function lista_espera(
  _params: Record<string, unknown>,
  ctx: AssistenteCtx,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('lista_espera')
    .select(
      'id, created_at, observacoes, pacientes(nome, telefone), procedimentos(nome)',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('profissional_id', ctx.profissionalId)
    .eq('status', 'aguardando')
    .order('created_at', { ascending: true })
    .limit(30);
  if (error) return `Erro ao consultar lista de espera: ${error.message}`;
  if (!data || data.length === 0) {
    return 'Nenhum paciente na lista de espera.';
  }
  const linhas = data.map((r) => {
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    const proc = Array.isArray(r.procedimentos)
      ? r.procedimentos[0]
      : r.procedimentos;
    const nome = (pac?.nome as string | null) ?? 'Paciente';
    const tel = formatTel((pac?.telefone as string | null) ?? null);
    const procNome = (proc?.nome as string | null) ?? null;
    const desde = isoDateBR(r.created_at as string);
    const partes = [nome];
    if (tel) partes.push(tel);
    if (procNome) partes.push(procNome);
    partes.push(`Desde: ${desde}`);
    return `- ${partes.join(' · ')}`;
  });
  return `Lista de espera (${data.length}):\n${linhas.join('\n')}`;
}

// ============================================================
// 7. estatisticas
// ============================================================

async function estatisticas(
  params: { tipo?: string },
  ctx: AssistenteCtx,
): Promise<string> {
  const tipo = params?.tipo ?? 'pacientes_novos';
  const admin = createAdminClient();
  const partes = partesSP(new Date());
  const { inicio, fim } = rangeDoMes(partes.year, partes.month);

  if (tipo === 'pacientes_novos') {
    const { count, error } = await admin
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', ctx.tenantId)
      .gte('created_at', inicio)
      .lte('created_at', fim);
    if (error) return `Erro: ${error.message}`;
    return `Pacientes novos no mês: ${count ?? 0}.`;
  }

  if (tipo === 'retornos') {
    const { data, error } = await admin
      .from('agendamentos')
      .select('paciente_id, status')
      .eq('tenant_id', ctx.tenantId)
      .eq('profissional_id', ctx.profissionalId)
      .eq('status', 'concluido');
    if (error) return `Erro: ${error.message}`;
    const porPac = new Map<string, number>();
    for (const r of data ?? []) {
      const pid = r.paciente_id as string;
      porPac.set(pid, (porPac.get(pid) ?? 0) + 1);
    }
    let retornos = 0;
    for (const v of porPac.values()) if (v >= 2) retornos++;
    return `Pacientes que retornaram (≥2 consultas concluídas): ${retornos}.`;
  }

  if (tipo === 'top_procedimentos') {
    const { data, error } = await admin
      .from('agendamentos')
      .select('procedimento_id, procedimentos(nome)')
      .eq('tenant_id', ctx.tenantId)
      .eq('profissional_id', ctx.profissionalId)
      .gte('data_hora', inicio)
      .lte('data_hora', fim)
      .neq('status', 'cancelado')
      .neq('status', 'reagendado');
    if (error) return `Erro: ${error.message}`;
    const contador = new Map<string, { nome: string; count: number }>();
    for (const r of data ?? []) {
      const proc = Array.isArray(r.procedimentos)
        ? r.procedimentos[0]
        : r.procedimentos;
      const nome = (proc?.nome as string | null) ?? 'Sem procedimento';
      const id = (r.procedimento_id as string | null) ?? 'sem';
      const atual = contador.get(id) ?? { nome, count: 0 };
      atual.count++;
      contador.set(id, atual);
    }
    const top = Array.from(contador.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    if (top.length === 0) return 'Sem procedimentos agendados no mês.';
    return [
      'Top procedimentos do mês:',
      ...top.map((t, i) => `${i + 1}. ${t.nome} — ${t.count}`),
    ].join('\n');
  }

  if (tipo === 'horario_pico') {
    const { data, error } = await admin
      .from('agendamentos')
      .select('data_hora')
      .eq('tenant_id', ctx.tenantId)
      .eq('profissional_id', ctx.profissionalId)
      .eq('status', 'concluido')
      .gte('data_hora', inicio)
      .lte('data_hora', fim);
    if (error) return `Erro: ${error.message}`;
    const buckets = new Array<number>(24).fill(0);
    for (const r of data ?? []) {
      const p = partesSP(new Date(r.data_hora as string));
      buckets[p.hour]++;
    }
    const ranking = buckets
      .map((c, h) => ({ hora: h, count: c }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    if (ranking.length === 0) return 'Sem dados de horário no mês.';
    return [
      'Horários de pico (consultas concluídas no mês):',
      ...ranking.map(
        (r) =>
          `${pad2(r.hora)}:00 - ${pad2((r.hora + 1) % 24)}:00 — ${r.count} consultas`,
      ),
    ].join('\n');
  }

  if (tipo === 'faltas') {
    const { data, error } = await admin
      .from('agendamentos')
      .select('id, data_hora, pacientes(nome)')
      .eq('tenant_id', ctx.tenantId)
      .eq('profissional_id', ctx.profissionalId)
      .eq('status', 'faltou')
      .gte('data_hora', inicio)
      .lte('data_hora', fim)
      .order('data_hora', { ascending: false });
    if (error) return `Erro: ${error.message}`;
    if (!data || data.length === 0) return 'Nenhuma falta registrada no mês.';
    const linhas = data.slice(0, 15).map((r) => {
      const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
      const nome = (pac?.nome as string | null) ?? 'Paciente';
      return `- ${isoDateBR(r.data_hora as string)} · ${nome}`;
    });
    return `${data.length} falta(s) no mês:\n${linhas.join('\n')}`;
  }

  return `Tipo de estatística desconhecido: ${tipo}.`;
}

// ============================================================
// 8. uso_transcricao
// ============================================================

async function uso_transcricao(
  _params: Record<string, unknown>,
  ctx: AssistenteCtx,
): Promise<string> {
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('plano')
    .eq('id', ctx.tenantId)
    .maybeSingle();
  const plano = (tenant?.plano as string | null) ?? 'trial';
  const limiteSeg = getLimiteTranscricao(plano);
  const info = getInfoPlano(plano);

  if (limiteSeg <= 0) {
    return `Sem transcrição no plano ${info.nome}. Faça upgrade para usar essa função.`;
  }

  const mesAno = new Date().toISOString().slice(0, 7);
  const { data, error } = await admin
    .from('uso_transcricao')
    .select('segundos_usados')
    .eq('tenant_id', ctx.tenantId)
    .eq('mes_ano', mesAno);
  if (error) return `Erro ao consultar uso: ${error.message}`;
  const usadoSeg = (data ?? []).reduce(
    (acc, r) => acc + (Number(r.segundos_usados) || 0),
    0,
  );
  const usadoMin = Math.floor(usadoSeg / 60);
  const limiteMin = Math.floor(limiteSeg / 60);
  const pct = limiteSeg > 0 ? Math.round((usadoSeg / limiteSeg) * 100) : 0;
  return `Transcrição (${info.nome}): ${usadoMin} de ${limiteMin} minutos usados (${pct}%).`;
}

// ============================================================
// OpenAI tools schema + executors
// ============================================================

export const assistenteTools = [
  {
    type: 'function' as const,
    function: {
      name: 'agenda_hoje',
      description:
        'Lista os agendamentos do profissional para o dia de hoje (ignora cancelados e reagendados).',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'agenda_dia',
      description:
        'Lista agendamentos do profissional em uma data específica. Se a data não for informada, usa amanhã.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data no formato AAAA-MM-DD.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'buscar_paciente',
      description:
        'Busca pacientes do tenant por nome ou telefone (mín. 2 caracteres). Retorna idade, telefone, e-mail, convênio e última consulta. Nunca retorna CPF.',
      parameters: {
        type: 'object',
        properties: {
          termo: {
            type: 'string',
            description: 'Trecho do nome ou telefone (com ou sem máscara).',
          },
        },
        required: ['termo'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'financeiro_resumo',
      description:
        'Resumo financeiro (receitas pagas, despesas pagas, saldo, distribuição por forma de pagamento).',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['mes_atual', 'mes_anterior', 'semana', 'hoje'],
            description: 'Janela do resumo. Default: mes_atual.',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'financeiro_pendente',
      description:
        'Lista lançamentos de receita ainda não pagos, ordenados por valor.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'lista_espera',
      description:
        'Lista pacientes na lista de espera com status aguardando para o profissional.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'estatisticas',
      description:
        'Estatísticas do mês: pacientes novos, taxa de retorno, top procedimentos, horário de pico ou faltas.',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: [
              'pacientes_novos',
              'retornos',
              'top_procedimentos',
              'horario_pico',
              'faltas',
            ],
          },
        },
        required: ['tipo'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'uso_transcricao',
      description:
        'Mostra quantos minutos de transcrição já foram usados no mês corrente vs o limite do plano.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

export const assistenteExecutors: Record<
  string,
  (params: Record<string, unknown>, ctx: AssistenteCtx) => Promise<string>
> = {
  agenda_hoje,
  agenda_dia: (params, ctx) =>
    agenda_dia(params as { data?: string }, ctx),
  buscar_paciente: (params, ctx) =>
    buscar_paciente(params as { termo?: string }, ctx),
  financeiro_resumo: (params, ctx) =>
    financeiro_resumo(params as { periodo?: string }, ctx),
  financeiro_pendente,
  lista_espera,
  estatisticas: (params, ctx) =>
    estatisticas(params as { tipo?: string }, ctx),
  uso_transcricao,
};
