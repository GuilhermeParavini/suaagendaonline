'use server';

import { createAdminClient } from '@/lib/supabase/server';

const TENANT_ID = '4dcf2f82-1e39-4a9b-958d-9cb22c1754d6';
const USER_ID = 'a501e937-7651-41e7-b640-d36dad4a9772';

type SeedSummary = {
  profissional_id: string;
  horarios: { inserted: number; skipped: boolean };
  procedimentos: { inserted: number; skipped: boolean };
  pacientes: { inserted: number; skipped: boolean };
  agendamentos: { inserted: number; skipped: boolean };
  financeiro: { inserted: number; skipped: boolean };
};

function computeCpf(prefix9: string): string {
  const digits = prefix9.split('').map(Number);
  if (digits.length !== 9 || digits.some((d) => Number.isNaN(d))) {
    throw new Error(`CPF prefix invalido: ${prefix9}`);
  }

  const sum1 = digits.reduce((acc, d, i) => acc + d * (10 - i), 0);
  const mod1 = sum1 % 11;
  const d1 = mod1 < 2 ? 0 : 11 - mod1;

  const digits10 = [...digits, d1];
  const sum2 = digits10.reduce((acc, d, i) => acc + d * (11 - i), 0);
  const mod2 = sum2 % 11;
  const d2 = mod2 < 2 ? 0 : 11 - mod2;

  return `${prefix9}${d1}${d2}`;
}

function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function setHourMinute(date: Date, hour: number, minute: number): string {
  const d = new Date(date);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

type CleanSummary = {
  financeiro: number;
  agendamentos: number;
  responsaveis: number;
  pacientes: number;
  procedimentos: number;
  horarios: number;
};

export async function cleanSeed(): Promise<
  { ok: true; deleted: CleanSummary } | { ok: false; error: string }
> {
  const supabase = createAdminClient();

  const { data: prof, error: profError } = await supabase
    .from('profissionais')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();
  if (profError) return { ok: false, error: `cleanSeed prof: ${profError.message}` };
  if (!prof) return { ok: false, error: 'Profissional nao encontrado para limpeza.' };

  const profissionalId = prof.id as string;

  const deleted: CleanSummary = {
    financeiro: 0,
    agendamentos: 0,
    responsaveis: 0,
    pacientes: 0,
    procedimentos: 0,
    horarios: 0,
  };

  // 1. Financeiro do tenant
  {
    const { data, error } = await supabase
      .from('financeiro')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .select('id');
    if (error) return { ok: false, error: `cleanSeed financeiro: ${error.message}` };
    deleted.financeiro = data?.length ?? 0;
  }

  // 2. Agendamentos do tenant
  {
    const { data, error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .select('id');
    if (error) return { ok: false, error: `cleanSeed agendamentos: ${error.message}` };
    deleted.agendamentos = data?.length ?? 0;
  }

  // 3. Responsaveis (via paciente_id no tenant)
  {
    const { data: pacientes, error: pacErr } = await supabase
      .from('pacientes')
      .select('id')
      .eq('tenant_id', TENANT_ID);
    if (pacErr) return { ok: false, error: `cleanSeed pacientes lookup: ${pacErr.message}` };

    if (pacientes && pacientes.length > 0) {
      const ids = pacientes.map((p) => p.id as string);
      const { data, error } = await supabase
        .from('responsaveis')
        .delete()
        .in('paciente_id', ids)
        .select('id');
      if (error) return { ok: false, error: `cleanSeed responsaveis: ${error.message}` };
      deleted.responsaveis = data?.length ?? 0;
    }
  }

  // 4. Pacientes do tenant
  {
    const { data, error } = await supabase
      .from('pacientes')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .select('id');
    if (error) return { ok: false, error: `cleanSeed pacientes: ${error.message}` };
    deleted.pacientes = data?.length ?? 0;
  }

  // 5. Procedimentos do tenant
  {
    const { data, error } = await supabase
      .from('procedimentos')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .select('id');
    if (error) return { ok: false, error: `cleanSeed procedimentos: ${error.message}` };
    deleted.procedimentos = data?.length ?? 0;
  }

  // 6. Horarios disponiveis do profissional
  {
    const { data, error } = await supabase
      .from('horarios_disponiveis')
      .delete()
      .eq('profissional_id', profissionalId)
      .select('id');
    if (error) return { ok: false, error: `cleanSeed horarios: ${error.message}` };
    deleted.horarios = data?.length ?? 0;
  }

  return { ok: true, deleted };
}

export async function seedDatabase(): Promise<
  { ok: true; summary: SeedSummary } | { ok: false; error: string }
> {
  const supabase = createAdminClient();

  // 1. Buscar profissional
  const { data: prof, error: profError } = await supabase
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', USER_ID)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (profError) {
    return { ok: false, error: `Erro ao buscar profissional: ${profError.message}` };
  }
  if (!prof) {
    return { ok: false, error: 'Profissional nao encontrado para o tenant/user informados.' };
  }

  const profissionalId = prof.id as string;
  const tenantId = prof.tenant_id as string;

  const summary: SeedSummary = {
    profissional_id: profissionalId,
    horarios: { inserted: 0, skipped: false },
    procedimentos: { inserted: 0, skipped: false },
    pacientes: { inserted: 0, skipped: false },
    agendamentos: { inserted: 0, skipped: false },
    financeiro: { inserted: 0, skipped: false },
  };

  // 2. Horarios (seg-sex, manha 08-12 e tarde 14-18)
  {
    const { count } = await supabase
      .from('horarios_disponiveis')
      .select('id', { count: 'exact', head: true })
      .eq('profissional_id', profissionalId);

    if ((count ?? 0) > 0) {
      summary.horarios.skipped = true;
    } else {
      const rows = [];
      for (let dia = 1; dia <= 5; dia++) {
        rows.push({
          profissional_id: profissionalId,
          dia_semana: dia,
          hora_inicio: '08:00:00',
          hora_fim: '12:00:00',
          ativo: true,
        });
        rows.push({
          profissional_id: profissionalId,
          dia_semana: dia,
          hora_inicio: '14:00:00',
          hora_fim: '18:00:00',
          ativo: true,
        });
      }
      const { error } = await supabase.from('horarios_disponiveis').insert(rows);
      if (error) return { ok: false, error: `horarios: ${error.message}` };
      summary.horarios.inserted = rows.length;
    }
  }

  // 3. Procedimentos
  const procedimentosBase = [
    { nome: 'Avaliação fisioterapêutica', duracao_min: 60, valor: 200 },
    { nome: 'Sessão de fisioterapia', duracao_min: 45, valor: 150 },
    { nome: 'RPG', duracao_min: 50, valor: 180 },
  ];

  const procedimentoIdByNome = new Map<string, string>();
  {
    const { data: existing, error: existingErr } = await supabase
      .from('procedimentos')
      .select('id, nome')
      .eq('tenant_id', tenantId)
      .in(
        'nome',
        procedimentosBase.map((p) => p.nome),
      );
    if (existingErr) return { ok: false, error: `procedimentos check: ${existingErr.message}` };

    for (const row of existing ?? []) {
      procedimentoIdByNome.set(row.nome as string, row.id as string);
    }

    const toInsert = procedimentosBase
      .filter((p) => !procedimentoIdByNome.has(p.nome))
      .map((p) => ({
        tenant_id: tenantId,
        profissional_id: profissionalId,
        nome: p.nome,
        duracao_min: p.duracao_min,
        valor: p.valor,
        ativo: true,
      }));

    if (toInsert.length === 0) {
      summary.procedimentos.skipped = true;
    } else {
      const { data: inserted, error } = await supabase
        .from('procedimentos')
        .insert(toInsert)
        .select('id, nome');
      if (error) return { ok: false, error: `procedimentos: ${error.message}` };
      for (const row of inserted ?? []) {
        procedimentoIdByNome.set(row.nome as string, row.id as string);
      }
      summary.procedimentos.inserted = toInsert.length;
    }
  }

  // 4. Pacientes (com responsavel para Pedro Costa)
  type PacienteSeed = {
    key: string;
    nome: string;
    cpfPrefix: string;
    data_nascimento: string;
    genero: 'masculino' | 'feminino';
    telefone: string;
    responsavel?: { nome: string; cpfPrefix: string; telefone: string; grau: 'mae' | 'pai' };
  };

  const pacientesBase: PacienteSeed[] = [
    { key: 'maria', nome: 'Maria Silva', cpfPrefix: '111222333', data_nascimento: '1981-03-15', genero: 'feminino', telefone: '47999001001' },
    { key: 'joao', nome: 'João Santos', cpfPrefix: '222333444', data_nascimento: '1994-07-22', genero: 'masculino', telefone: '47999002002' },
    { key: 'ana', nome: 'Ana Oliveira', cpfPrefix: '333444555', data_nascimento: '1998-01-10', genero: 'feminino', telefone: '47999003003' },
    {
      key: 'pedro',
      nome: 'Pedro Costa',
      cpfPrefix: '444555666',
      data_nascimento: '2012-11-05',
      genero: 'masculino',
      telefone: '47999004004',
      responsavel: { nome: 'Carla Costa', cpfPrefix: '555666777', telefone: '47999004004', grau: 'mae' },
    },
    { key: 'lucia', nome: 'Lúcia Ferreira', cpfPrefix: '666777888', data_nascimento: '1959-06-30', genero: 'feminino', telefone: '47999005005' },
  ];

  const pacientesComCpf = pacientesBase.map((p) => ({ ...p, cpf: computeCpf(p.cpfPrefix) }));

  const pacienteIdByKey = new Map<string, string>();
  {
    const { data: existing, error: existingErr } = await supabase
      .from('pacientes')
      .select('id, cpf')
      .eq('tenant_id', tenantId)
      .in(
        'cpf',
        pacientesComCpf.map((p) => p.cpf),
      );
    if (existingErr) return { ok: false, error: `pacientes check: ${existingErr.message}` };

    const cpfToId = new Map<string, string>();
    for (const row of existing ?? []) cpfToId.set(row.cpf as string, row.id as string);

    for (const p of pacientesComCpf) {
      const id = cpfToId.get(p.cpf);
      if (id) pacienteIdByKey.set(p.key, id);
    }

    const toInsert = pacientesComCpf
      .filter((p) => !pacienteIdByKey.has(p.key))
      .map((p) => ({
        tenant_id: tenantId,
        nome: p.nome,
        cpf: p.cpf,
        data_nascimento: p.data_nascimento,
        genero: p.genero,
        telefone: p.telefone,
        ativo: true,
      }));

    if (toInsert.length === 0) {
      summary.pacientes.skipped = true;
    } else {
      const { data: inserted, error } = await supabase
        .from('pacientes')
        .insert(toInsert)
        .select('id, cpf');
      if (error) return { ok: false, error: `pacientes: ${error.message}` };
      const newCpfToId = new Map<string, string>();
      for (const row of inserted ?? []) newCpfToId.set(row.cpf as string, row.id as string);
      for (const p of pacientesComCpf) {
        if (!pacienteIdByKey.has(p.key)) {
          const id = newCpfToId.get(p.cpf);
          if (id) pacienteIdByKey.set(p.key, id);
        }
      }
      summary.pacientes.inserted = toInsert.length;

      // Inserir responsaveis para os pacientes recem-criados que sao menores
      const responsaveisToInsert = pacientesComCpf
        .filter((p) => p.responsavel && newCpfToId.has(p.cpf))
        .map((p) => ({
          paciente_id: newCpfToId.get(p.cpf)!,
          nome: p.responsavel!.nome,
          cpf: computeCpf(p.responsavel!.cpfPrefix),
          telefone: p.responsavel!.telefone,
          grau_parentesco: p.responsavel!.grau,
        }));

      if (responsaveisToInsert.length > 0) {
        const { error: respError } = await supabase
          .from('responsaveis')
          .insert(responsaveisToInsert);
        if (respError) return { ok: false, error: `responsaveis: ${respError.message}` };
      }
    }
  }

  // 5. Agendamentos: 8 entre hoje e amanha
  const hoje = startOfDayUTC(new Date());
  const amanha = new Date(hoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);

  const procAvaliacao = procedimentoIdByNome.get('Avaliação fisioterapêutica')!;
  const procSessao = procedimentoIdByNome.get('Sessão de fisioterapia')!;
  const procRpg = procedimentoIdByNome.get('RPG')!;

  const agendamentosBase = [
    { dia: hoje, hora: 8, min: 0, paciente: 'maria', procedimento_id: procAvaliacao, duracao: 60, status: 'concluido' as const },
    { dia: hoje, hora: 9, min: 30, paciente: 'joao', procedimento_id: procSessao, duracao: 45, status: 'concluido' as const },
    { dia: hoje, hora: 11, min: 0, paciente: 'ana', procedimento_id: procRpg, duracao: 50, status: 'em_atendimento' as const },
    { dia: hoje, hora: 14, min: 0, paciente: 'pedro', procedimento_id: procSessao, duracao: 45, status: 'confirmado' as const },
    { dia: amanha, hora: 8, min: 30, paciente: 'lucia', procedimento_id: procAvaliacao, duracao: 60, status: 'confirmado' as const },
    { dia: amanha, hora: 10, min: 0, paciente: 'maria', procedimento_id: procSessao, duracao: 45, status: 'agendado' as const },
    { dia: amanha, hora: 14, min: 30, paciente: 'joao', procedimento_id: procRpg, duracao: 50, status: 'agendado' as const },
    { dia: amanha, hora: 16, min: 0, paciente: 'ana', procedimento_id: procSessao, duracao: 45, status: 'faltou' as const },
  ];

  const agendamentosByPacienteHora = new Map<string, string>();
  {
    const inicio = hoje.toISOString();
    const fim = new Date(amanha);
    fim.setUTCHours(23, 59, 59, 999);

    const { count } = await supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('profissional_id', profissionalId)
      .gte('data_hora', inicio)
      .lte('data_hora', fim.toISOString());

    if ((count ?? 0) > 0) {
      summary.agendamentos.skipped = true;

      // Carregar agendamentos existentes para usar no financeiro
      const { data: existing, error: exErr } = await supabase
        .from('agendamentos')
        .select('id, data_hora, paciente_id, status')
        .eq('profissional_id', profissionalId)
        .gte('data_hora', inicio)
        .lte('data_hora', fim.toISOString());
      if (exErr) return { ok: false, error: `agendamentos check: ${exErr.message}` };
      for (const row of existing ?? []) {
        const normalized = new Date(row.data_hora as string).toISOString();
        agendamentosByPacienteHora.set(`${row.paciente_id}|${normalized}`, row.id as string);
      }
    } else {
      const rows = agendamentosBase.map((ag) => ({
        tenant_id: tenantId,
        profissional_id: profissionalId,
        paciente_id: pacienteIdByKey.get(ag.paciente)!,
        procedimento_id: ag.procedimento_id,
        data_hora: setHourMinute(ag.dia, ag.hora, ag.min),
        duracao_min: ag.duracao,
        status: ag.status,
        tolerancia_min: 5,
      }));

      const { data: inserted, error } = await supabase
        .from('agendamentos')
        .insert(rows)
        .select('id, data_hora, paciente_id, status');
      if (error) return { ok: false, error: `agendamentos: ${error.message}` };
      for (const row of inserted ?? []) {
        const normalized = new Date(row.data_hora as string).toISOString();
        agendamentosByPacienteHora.set(`${row.paciente_id}|${normalized}`, row.id as string);
      }
      summary.agendamentos.inserted = rows.length;
    }
  }

  // 6. Financeiro: 3 receitas vinculadas aos agendamentos concluidos
  {
    const concluidos = agendamentosBase.filter((a) => a.status === 'concluido');

    const findAgendamentoId = (paciente: string, dia: Date, hora: number, min: number) => {
      const pacienteId = pacienteIdByKey.get(paciente);
      if (!pacienteId) return null;
      const dataHora = new Date(setHourMinute(dia, hora, min)).toISOString();
      return agendamentosByPacienteHora.get(`${pacienteId}|${dataHora}`) ?? null;
    };

    const lancamentos: Array<{
      agendamento_id: string | null;
      paciente_id: string | null;
      tipo: 'receita';
      descricao: string;
      valor: number;
      forma_pagamento: 'pix' | 'cartao_credito' | 'dinheiro';
      data_lancamento: string;
      data_pagamento: string;
      pago: boolean;
    }> = [];

    if (concluidos.length >= 1) {
      const c1 = concluidos[0];
      lancamentos.push({
        agendamento_id: findAgendamentoId(c1.paciente, c1.dia, c1.hora, c1.min),
        paciente_id: pacienteIdByKey.get(c1.paciente) ?? null,
        tipo: 'receita',
        descricao: 'Avaliação fisioterapêutica',
        valor: 200,
        forma_pagamento: 'pix',
        data_lancamento: c1.dia.toISOString().slice(0, 10),
        data_pagamento: c1.dia.toISOString().slice(0, 10),
        pago: true,
      });
    }
    if (concluidos.length >= 2) {
      const c2 = concluidos[1];
      lancamentos.push({
        agendamento_id: findAgendamentoId(c2.paciente, c2.dia, c2.hora, c2.min),
        paciente_id: pacienteIdByKey.get(c2.paciente) ?? null,
        tipo: 'receita',
        descricao: 'Sessão de fisioterapia',
        valor: 150,
        forma_pagamento: 'cartao_credito',
        data_lancamento: c2.dia.toISOString().slice(0, 10),
        data_pagamento: c2.dia.toISOString().slice(0, 10),
        pago: true,
      });
      // Terceiro lancamento: pagamento complementar do segundo concluido
      lancamentos.push({
        agendamento_id: findAgendamentoId(c2.paciente, c2.dia, c2.hora, c2.min),
        paciente_id: pacienteIdByKey.get(c2.paciente) ?? null,
        tipo: 'receita',
        descricao: 'Sessão de fisioterapia (complemento)',
        valor: 50,
        forma_pagamento: 'dinheiro',
        data_lancamento: c2.dia.toISOString().slice(0, 10),
        data_pagamento: c2.dia.toISOString().slice(0, 10),
        pago: true,
      });
    }

    if (lancamentos.length === 0) {
      summary.financeiro.skipped = true;
    } else {
      // Idempotencia: se ja existem receitas para os agendamentos concluidos, skip
      const agendamentoIds = lancamentos
        .map((l) => l.agendamento_id)
        .filter((id): id is string => id !== null);

      let alreadyExists = 0;
      if (agendamentoIds.length > 0) {
        const { count } = await supabase
          .from('financeiro')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('tipo', 'receita')
          .in('agendamento_id', agendamentoIds);
        alreadyExists = count ?? 0;
      }

      if (alreadyExists > 0) {
        summary.financeiro.skipped = true;
      } else {
        const rows = lancamentos.map((l) => ({
          tenant_id: tenantId,
          agendamento_id: l.agendamento_id,
          paciente_id: l.paciente_id,
          profissional_id: profissionalId,
          tipo: l.tipo,
          descricao: l.descricao,
          valor: l.valor,
          forma_pagamento: l.forma_pagamento,
          data_lancamento: l.data_lancamento,
          data_pagamento: l.data_pagamento,
          pago: l.pago,
          categoria: 'consulta',
        }));
        const { error } = await supabase.from('financeiro').insert(rows);
        if (error) return { ok: false, error: `financeiro: ${error.message}` };
        summary.financeiro.inserted = rows.length;
      }
    }
  }

  return { ok: true, summary };
}
