'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getBloqueiosForProfissional,
  getFeriadosForTenant,
} from '@/lib/feriados-bloqueios';
import { cleanCEP, cleanCPF, cleanPhone } from '@/lib/masks';
import { isValidBirthDate, isMinor, validateCPF } from '@/lib/validators';
import {
  emailConfirmacaoAgendamento,
  emailReagendamento,
  horarioFromIso,
  dataIsoFromTimestamp,
  montarLinkAgendamento,
  montarLinkReagendar,
} from '@/lib/email-templates';
import { enviarNotificacaoEmail } from '@/lib/notificacoes';

export type Slot = { time: string; available: boolean };
export type DiaIndisponivel =
  | { tipo: 'feriado'; nome: string }
  | { tipo: 'bloqueio'; motivo: string | null };

export type Genero = 'masculino' | 'feminino' | 'prefiro_nao_informar';
export type GrauParentesco = 'mae' | 'pai' | 'avo' | 'tio' | 'outro';

export type NovoPacientePublico = {
  nome: string;
  cpf: string;
  data_nascimento: string;
  genero: Genero;
  telefone: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  responsavel?: {
    nome: string;
    cpf: string;
    telefone: string;
    email?: string;
    grau_parentesco: GrauParentesco;
  };
};

export type ConfirmarInput = {
  tenantId: string;
  profissionalId: string;
  procedimentoId: string;
  dataIso: string;
  hora: string;
  aceiteLgpd: boolean;
  pacienteExistenteId?: string;
  novoPaciente?: NovoPacientePublico;
};

const LGPD_TEXT =
  'Termo de consentimento LGPD aceito pelo paciente no agendamento online. ' +
  'Autoriza tratamento de dados pessoais e sensíveis para finalidade clínica e administrativa, ' +
  'conforme Lei 13.709/2018.';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildIsoDateTime(dataIso: string, hora: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));
  return date.toISOString();
}

export async function getDisponibilidade(
  profissionalId: string,
  dataIso: string,
  procedimentoId: string,
): Promise<
  | { ok: true; slots: Slot[]; duracaoMin: number; indisponivel?: DiaIndisponivel }
  | { ok: false; error: string }
> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
    return { ok: false, error: 'Data inválida.' };
  }

  const admin = createAdminClient();

  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('duracao_padrao_min, intervalo_entre_consultas_min, tenant_id')
    .eq('id', profissionalId)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional não encontrado.' };

  const duracaoPadraoMin = (prof.duracao_padrao_min as number) ?? 30;
  const intervaloEntreMin =
    (prof.intervalo_entre_consultas_min as number | null) ?? 0;
  const tenantId = prof.tenant_id as string;

  const { data: proc, error: procErr } = await admin
    .from('procedimentos')
    .select('duracao_min')
    .eq('id', procedimentoId)
    .maybeSingle();
  if (procErr) return { ok: false, error: procErr.message };
  if (!proc) return { ok: false, error: 'Procedimento não encontrado.' };

  const duracaoMin = (proc.duracao_min as number) ?? duracaoPadraoMin;

  // Bloqueia feriados e ausencias do profissional
  try {
    const [feriados, bloqueios] = await Promise.all([
      getFeriadosForTenant(tenantId, dataIso, dataIso),
      getBloqueiosForProfissional(profissionalId, dataIso, dataIso),
    ]);
    if (feriados.length > 0) {
      return {
        ok: true,
        slots: [],
        duracaoMin,
        indisponivel: { tipo: 'feriado', nome: feriados[0].nome },
      };
    }
    if (bloqueios.length > 0) {
      return {
        ok: true,
        slots: [],
        duracaoMin,
        indisponivel: { tipo: 'bloqueio', motivo: bloqueios[0].motivo },
      };
    }
  } catch (e) {
    console.error('[agendamento-publico] erro ao checar feriados/bloqueios:', e);
  }

  // Postgres dia_semana: 0=domingo, 6=sabado (igual JS Date.getDay)
  const [y, m, d] = dataIso.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const { data: horarios, error: horError } = await admin
    .from('horarios_disponiveis')
    .select('hora_inicio, hora_fim')
    .eq('profissional_id', profissionalId)
    .eq('ativo', true)
    .eq('dia_semana', diaSemana);
  if (horError) return { ok: false, error: horError.message };
  if (!horarios || horarios.length === 0) {
    return { ok: true, slots: [], duracaoMin };
  }

  // Carregar agendamentos existentes do dia
  const inicio = `${dataIso}T00:00:00.000Z`;
  const fim = `${dataIso}T23:59:59.999Z`;
  const { data: existentes, error: agErr } = await admin
    .from('agendamentos')
    .select('data_hora, duracao_min, status')
    .eq('profissional_id', profissionalId)
    .gte('data_hora', inicio)
    .lte('data_hora', fim)
    .neq('status', 'cancelado');
  if (agErr) return { ok: false, error: agErr.message };

  const ocupados = (existentes ?? []).map((row) => {
    const start = new Date(row.data_hora as string).getTime();
    const dur = (row.duracao_min as number) ?? duracaoPadraoMin;
    return { start, end: start + (dur + intervaloEntreMin) * 60_000 };
  });

  const agora = Date.now();

  const slots: Slot[] = [];
  const seen = new Set<string>();
  const passoMin = duracaoMin + intervaloEntreMin;

  for (const range of horarios) {
    const [hi, mi] = (range.hora_inicio as string).split(':').map(Number);
    const [hf, mf] = (range.hora_fim as string).split(':').map(Number);
    const startMin = hi * 60 + mi;
    const endMin = hf * 60 + mf;

    for (let cur = startMin; cur + duracaoMin <= endMin; cur += passoMin) {
      const h = Math.floor(cur / 60);
      const mm = cur % 60;
      const time = `${pad2(h)}:${pad2(mm)}`;
      if (seen.has(time)) continue;
      seen.add(time);

      const slotIso = buildIsoDateTime(dataIso, time);
      const slotStart = new Date(slotIso).getTime();
      const slotEnd = slotStart + (duracaoMin + intervaloEntreMin) * 60_000;

      const isPast = slotStart <= agora;
      const isOccupied = ocupados.some(
        (o) => slotStart < o.end && slotEnd > o.start,
      );

      slots.push({ time, available: !isPast && !isOccupied });
    }
  }

  slots.sort((a, b) => a.time.localeCompare(b.time));
  return { ok: true, slots, duracaoMin };
}

export async function verificarPacientePorCPF(
  cpf: string,
  tenantId: string,
): Promise<
  | { ok: true; existe: false }
  | { ok: true; existe: true; paciente: { id: string; nome: string; menor_idade: boolean } }
  | { ok: false; error: string }
> {
  const cpfDigits = cleanCPF(cpf);
  if (!validateCPF(cpfDigits)) {
    return { ok: false, error: 'CPF inválido.' };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('pacientes')
    .select('id, nome, menor_idade')
    .eq('tenant_id', tenantId)
    .eq('cpf', cpfDigits)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, existe: false };
  return {
    ok: true,
    existe: true,
    paciente: {
      id: data.id as string,
      nome: data.nome as string,
      menor_idade: Boolean(data.menor_idade),
    },
  };
}

export async function criarAgendamentoPublico(
  input: ConfirmarInput,
): Promise<{ ok: true; agendamentoId: string } | { ok: false; error: string }> {
  if (!input.aceiteLgpd) {
    return { ok: false, error: 'É necessário aceitar o termo de consentimento.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dataIso)) {
    return { ok: false, error: 'Data inválida.' };
  }
  if (!/^\d{2}:\d{2}$/.test(input.hora)) {
    return { ok: false, error: 'Horário inválido.' };
  }

  const admin = createAdminClient();

  // Confere tenant + profissional
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id, tolerancia_atraso_min, intervalo_entre_consultas_min')
    .eq('id', input.profissionalId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: 'Profissional não encontrado.' };

  const intervaloEntreMin =
    (prof.intervalo_entre_consultas_min as number | null) ?? 0;

  // Confere procedimento
  const { data: proc, error: procErr } = await admin
    .from('procedimentos')
    .select('id, nome, duracao_min')
    .eq('id', input.procedimentoId)
    .eq('tenant_id', input.tenantId)
    .eq('ativo', true)
    .maybeSingle();
  if (procErr) return { ok: false, error: procErr.message };
  if (!proc) return { ok: false, error: 'Procedimento indisponível.' };

  const duracaoMin = (proc.duracao_min as number) ?? 30;
  const dataHoraIso = buildIsoDateTime(input.dataIso, input.hora);
  const startMs = new Date(dataHoraIso).getTime();
  const endMs = startMs + (duracaoMin + intervaloEntreMin) * 60_000;

  if (startMs <= Date.now()) {
    return { ok: false, error: 'Horário já passou. Escolha outro.' };
  }

  // Bloqueia feriados e ausencias
  try {
    const [feriados, bloqueios] = await Promise.all([
      getFeriadosForTenant(input.tenantId, input.dataIso, input.dataIso),
      getBloqueiosForProfissional(input.profissionalId, input.dataIso, input.dataIso),
    ]);
    if (feriados.length > 0) {
      return { ok: false, error: 'Data indisponível (feriado). Escolha outra.' };
    }
    if (bloqueios.length > 0) {
      return { ok: false, error: 'Data indisponível. Escolha outra.' };
    }
  } catch (e) {
    console.error('[agendamento-publico] erro ao checar feriados/bloqueios:', e);
  }

  // Verifica conflito de horario
  const dayInicio = `${input.dataIso}T00:00:00.000Z`;
  const dayFim = `${input.dataIso}T23:59:59.999Z`;
  const { data: existentes, error: existErr } = await admin
    .from('agendamentos')
    .select('data_hora, duracao_min, status')
    .eq('profissional_id', input.profissionalId)
    .gte('data_hora', dayInicio)
    .lte('data_hora', dayFim)
    .neq('status', 'cancelado');
  if (existErr) return { ok: false, error: existErr.message };

  const conflict = (existentes ?? []).some((row) => {
    const s = new Date(row.data_hora as string).getTime();
    const dur = (row.duracao_min as number) ?? 30;
    return startMs < s + (dur + intervaloEntreMin) * 60_000 && endMs > s;
  });
  if (conflict) {
    return { ok: false, error: 'Horário indisponível. Escolha outro.' };
  }

  // Resolver paciente: existente OU novo
  let pacienteId: string | null = null;
  let responsavelId: string | null = null;
  let createdPacienteId: string | null = null;
  let isMenor = false;

  if (input.pacienteExistenteId) {
    const { data: existing, error: exErr } = await admin
      .from('pacientes')
      .select('id, menor_idade')
      .eq('id', input.pacienteExistenteId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    if (exErr) return { ok: false, error: exErr.message };
    if (!existing) return { ok: false, error: 'Paciente não encontrado.' };
    pacienteId = existing.id as string;
    isMenor = Boolean(existing.menor_idade);
  } else if (input.novoPaciente) {
    const np = input.novoPaciente;
    const nome = np.nome?.trim() ?? '';
    if (nome.length < 3) return { ok: false, error: 'Nome inválido.' };

    const cpfDigits = cleanCPF(np.cpf ?? '');
    if (!validateCPF(cpfDigits)) return { ok: false, error: 'CPF inválido.' };

    if (!isValidBirthDate(np.data_nascimento)) {
      return { ok: false, error: 'Data de nascimento inválida.' };
    }
    if (!['masculino', 'feminino', 'prefiro_nao_informar'].includes(np.genero)) {
      return { ok: false, error: 'Gênero inválido.' };
    }
    const tel = cleanPhone(np.telefone ?? '');
    if (tel.length !== 10 && tel.length !== 11) {
      return { ok: false, error: 'Telefone inválido.' };
    }
    const email = np.email?.trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'E-mail inválido.' };
    }
    const cepDigits = np.cep ? cleanCEP(np.cep) : '';
    if (cepDigits && cepDigits.length !== 8) {
      return { ok: false, error: 'CEP inválido.' };
    }

    isMenor = isMinor(np.data_nascimento);

    if (isMenor) {
      const r = np.responsavel;
      if (!r) return { ok: false, error: 'Responsável obrigatório para menor de idade.' };
      if (!r.nome || r.nome.trim().length < 3) {
        return { ok: false, error: 'Nome do responsável inválido.' };
      }
      if (!validateCPF(r.cpf ?? '')) {
        return { ok: false, error: 'CPF do responsável inválido.' };
      }
      const respTel = cleanPhone(r.telefone ?? '');
      if (respTel.length !== 10 && respTel.length !== 11) {
        return { ok: false, error: 'Telefone do responsável inválido.' };
      }
      if (
        !['mae', 'pai', 'avo', 'tio', 'outro'].includes(r.grau_parentesco)
      ) {
        return { ok: false, error: 'Grau de parentesco inválido.' };
      }
    }

    // Checa duplicidade de CPF no tenant
    const { data: dup, error: dupErr } = await admin
      .from('pacientes')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('cpf', cpfDigits)
      .maybeSingle();
    if (dupErr) return { ok: false, error: dupErr.message };
    if (dup) {
      return {
        ok: false,
        error: 'Já existe paciente cadastrado com este CPF. Use a opção de identificação.',
      };
    }

    const { data: pacRow, error: pacErr } = await admin
      .from('pacientes')
      .insert({
        tenant_id: input.tenantId,
        nome,
        cpf: cpfDigits,
        data_nascimento: np.data_nascimento,
        genero: np.genero,
        telefone: tel,
        email: email,
        endereco: np.endereco?.trim() || null,
        cidade: np.cidade?.trim() || null,
        estado: np.estado?.trim() || null,
        cep: cepDigits || null,
        ativo: true,
      })
      .select('id')
      .single();
    if (pacErr || !pacRow) {
      return { ok: false, error: pacErr?.message ?? 'Falha ao salvar paciente.' };
    }

    pacienteId = pacRow.id as string;
    createdPacienteId = pacienteId;

    if (isMenor && np.responsavel) {
      const r = np.responsavel;
      const { data: respRow, error: respErr } = await admin
        .from('responsaveis')
        .insert({
          paciente_id: pacienteId,
          nome: r.nome.trim(),
          cpf: cleanCPF(r.cpf),
          telefone: cleanPhone(r.telefone),
          email: r.email?.trim() || null,
          grau_parentesco: r.grau_parentesco,
        })
        .select('id')
        .single();
      if (respErr || !respRow) {
        await admin.from('pacientes').delete().eq('id', pacienteId);
        return {
          ok: false,
          error: respErr?.message ?? 'Falha ao salvar responsável.',
        };
      }
      responsavelId = respRow.id as string;
    }

    const { error: consErr } = await admin.from('consentimentos').insert({
      paciente_id: pacienteId,
      responsavel_id: responsavelId,
      tipo: isMenor ? 'lgpd_menor' : 'lgpd_geral',
      aceite: true,
      texto_aceito: LGPD_TEXT,
    });
    if (consErr) {
      await admin.from('pacientes').delete().eq('id', pacienteId);
      return { ok: false, error: `Falha ao registrar consentimento: ${consErr.message}` };
    }
  } else {
    return { ok: false, error: 'Identificação do paciente obrigatória.' };
  }

  // Cria agendamento
  const { data: agRow, error: agErr } = await admin
    .from('agendamentos')
    .insert({
      tenant_id: input.tenantId,
      profissional_id: input.profissionalId,
      paciente_id: pacienteId,
      procedimento_id: proc.id,
      data_hora: dataHoraIso,
      duracao_min: duracaoMin,
      status: 'agendado',
      tolerancia_min: (prof.tolerancia_atraso_min as number) ?? 5,
    })
    .select('id, token_reagendamento')
    .single();
  if (agErr || !agRow) {
    if (createdPacienteId) {
      await admin.from('pacientes').delete().eq('id', createdPacienteId);
    }
    return { ok: false, error: agErr?.message ?? 'Falha ao criar agendamento.' };
  }

  const agendamentoId = agRow.id as string;
  const tokenReagendamento =
    (agRow.token_reagendamento as string | null) ?? null;

  try {
    const [{ data: pacienteEmail }, { data: profissional }, { data: tenant }] =
      await Promise.all([
        admin
          .from('pacientes')
          .select('nome, email')
          .eq('id', pacienteId)
          .maybeSingle(),
        admin
          .from('profissionais')
          .select('nome, logo_url')
          .eq('id', input.profissionalId)
          .maybeSingle(),
        admin
          .from('tenants')
          .select('slug')
          .eq('id', input.tenantId)
          .maybeSingle(),
      ]);

    const destino = (pacienteEmail?.email as string | null) ?? null;
    const pacienteNome = (pacienteEmail?.nome as string | null) ?? 'Paciente';
    const profissionalNome =
      (profissional?.nome as string | null) ?? 'Profissional';
    const logoUrl = (profissional?.logo_url as string | null) ?? null;
    const slug = (tenant?.slug as string | null) ?? null;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const linkAgendamento = montarLinkAgendamento(appUrl, slug);
    const linkReagendar = montarLinkReagendar(appUrl, tokenReagendamento);

    if (destino) {
      const tpl = emailConfirmacaoAgendamento({
        pacienteNome,
        profissionalNome,
        dataIso: input.dataIso,
        horario: horarioFromIso(dataHoraIso),
        linkAgendamento,
        linkReagendar,
        logoUrl,
      });
      await enviarNotificacaoEmail({
        tenantId: input.tenantId,
        agendamentoId,
        tipo: 'confirmacao',
        destino,
        assunto: tpl.assunto,
        html: tpl.html,
      });
    }
  } catch (e) {
    console.error('[agendamento-publico] Erro ao enviar email de confirmacao:', e);
  }

  return { ok: true, agendamentoId };
}

// ============================================================
// Reagendamento pelo paciente via link publico (token)
// ============================================================

export type AgendamentoReagendar = {
  id: string;
  tenantId: string;
  tenantSlug: string | null;
  dataHoraIso: string;
  duracaoMin: number;
  status: string;
  jaReagendado: boolean;
  expirado: boolean;
  paciente: { id: string; nome: string; email: string | null };
  profissional: {
    id: string;
    nome: string;
    especialidade: string | null;
    logoUrl: string | null;
    duracaoPadraoMin: number;
    intervaloEntreMin: number;
  };
  procedimento: {
    id: string;
    nome: string;
    duracaoMin: number;
    valor: number | null;
  } | null;
};

export async function getAgendamentoPorToken(
  token: string,
): Promise<
  | { ok: true; agendamento: AgendamentoReagendar }
  | { ok: false; error: string }
> {
  const cleanToken = (token ?? '').trim();
  if (!cleanToken || !/^[a-f0-9]{8,128}$/i.test(cleanToken)) {
    return { ok: false, error: 'Link invalido.' };
  }

  const admin = createAdminClient();
  const { data: ag, error } = await admin
    .from('agendamentos')
    .select(
      'id, tenant_id, profissional_id, paciente_id, procedimento_id, data_hora, duracao_min, status',
    )
    .eq('token_reagendamento', cleanToken)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!ag) return { ok: false, error: 'Agendamento nao encontrado.' };

  const tenantId = ag.tenant_id as string;
  const profissionalId = ag.profissional_id as string;
  const pacienteId = ag.paciente_id as string;
  const procedimentoId = (ag.procedimento_id as string | null) ?? null;
  const dataHoraIso = ag.data_hora as string;
  const status = ag.status as string;

  const [
    { data: tenant },
    { data: prof },
    { data: pac },
    { data: proc },
    { data: filhos },
  ] = await Promise.all([
    admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle(),
    admin
      .from('profissionais')
      .select(
        'id, nome, especialidade, logo_url, duracao_padrao_min, intervalo_entre_consultas_min',
      )
      .eq('id', profissionalId)
      .maybeSingle(),
    admin
      .from('pacientes')
      .select('id, nome, email')
      .eq('id', pacienteId)
      .maybeSingle(),
    procedimentoId
      ? admin
          .from('procedimentos')
          .select('id, nome, duracao_min, valor')
          .eq('id', procedimentoId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('agendamentos')
      .select('id')
      .eq('reagendado_de', ag.id as string)
      .limit(1),
  ]);

  if (!prof) return { ok: false, error: 'Profissional nao encontrado.' };
  if (!pac) return { ok: false, error: 'Paciente nao encontrado.' };

  const jaReagendado =
    status === 'reagendado' || ((filhos ?? []).length > 0);
  const startMs = new Date(dataHoraIso).getTime();
  const expirado = !Number.isFinite(startMs) || startMs <= Date.now();

  return {
    ok: true,
    agendamento: {
      id: ag.id as string,
      tenantId,
      tenantSlug: (tenant?.slug as string | null) ?? null,
      dataHoraIso,
      duracaoMin: (ag.duracao_min as number) ?? 30,
      status,
      jaReagendado,
      expirado,
      paciente: {
        id: pac.id as string,
        nome: pac.nome as string,
        email: (pac.email as string | null) ?? null,
      },
      profissional: {
        id: prof.id as string,
        nome: prof.nome as string,
        especialidade: (prof.especialidade as string | null) ?? null,
        logoUrl: (prof.logo_url as string | null) ?? null,
        duracaoPadraoMin: (prof.duracao_padrao_min as number) ?? 30,
        intervaloEntreMin:
          (prof.intervalo_entre_consultas_min as number | null) ?? 0,
      },
      procedimento: proc
        ? {
            id: proc.id as string,
            nome: proc.nome as string,
            duracaoMin: (proc.duracao_min as number) ?? 30,
            valor: proc.valor !== null ? Number(proc.valor) : null,
          }
        : null,
    },
  };
}

export type ReagendarPorPacienteResult =
  | {
      ok: true;
      novoAgendamentoId: string;
      novaDataIso: string;
      novaHora: string;
      profissionalNome: string;
    }
  | { ok: false; error: string };

function buildIsoDateTimeLocal(dataIso: string, hora: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0)).toISOString();
}

export async function reagendarPorPaciente(
  token: string,
  novaDataIso: string,
  novaHora: string,
): Promise<ReagendarPorPacienteResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(novaDataIso)) {
    return { ok: false, error: 'Data invalida.' };
  }
  if (!/^\d{2}:\d{2}$/.test(novaHora)) {
    return { ok: false, error: 'Horario invalido.' };
  }

  const result = await getAgendamentoPorToken(token);
  if (!result.ok) return result;
  const ag = result.agendamento;

  if (ag.status !== 'agendado' && ag.status !== 'confirmado') {
    return {
      ok: false,
      error: 'Este agendamento nao pode mais ser reagendado.',
    };
  }
  if (ag.expirado) {
    return { ok: false, error: 'Este agendamento ja passou.' };
  }
  if (ag.jaReagendado) {
    return { ok: false, error: 'Este agendamento ja foi reagendado.' };
  }

  const admin = createAdminClient();

  const procedimentoId = ag.procedimento?.id ?? null;
  const duracaoMin = ag.procedimento?.duracaoMin ?? ag.duracaoMin;
  const intervaloEntreMin = ag.profissional.intervaloEntreMin;

  const novaDataHoraIso = buildIsoDateTimeLocal(novaDataIso, novaHora);
  const startMs = new Date(novaDataHoraIso).getTime();
  const endMs = startMs + (duracaoMin + intervaloEntreMin) * 60_000;

  if (startMs <= Date.now()) {
    return { ok: false, error: 'Horario ja passou. Escolha outro.' };
  }

  // Feriados
  try {
    const feriados = await getFeriadosForTenant(
      ag.tenantId,
      novaDataIso,
      novaDataIso,
    );
    if (feriados.length > 0) {
      return {
        ok: false,
        error: `Data indisponivel (feriado: ${feriados[0].nome}).`,
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: `Falha ao verificar feriados: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Bloqueios (permissivo)
  try {
    const bloqueios = await getBloqueiosForProfissional(
      ag.profissional.id,
      novaDataIso,
      novaDataIso,
    );
    if (bloqueios.length > 0) {
      return { ok: false, error: 'Data indisponivel.' };
    }
  } catch (e) {
    console.error('[reagendarPorPaciente] erro ao checar bloqueios:', e);
  }

  // Conflitos (ignora o agendamento atual)
  const dayInicio = `${novaDataIso}T00:00:00.000Z`;
  const dayFim = `${novaDataIso}T23:59:59.999Z`;
  const { data: existentes, error: existErr } = await admin
    .from('agendamentos')
    .select('id, data_hora, duracao_min, status')
    .eq('profissional_id', ag.profissional.id)
    .gte('data_hora', dayInicio)
    .lte('data_hora', dayFim)
    .neq('status', 'cancelado')
    .neq('status', 'reagendado');
  if (existErr) return { ok: false, error: existErr.message };

  const conflito = (existentes ?? [])
    .filter((row) => (row.id as string) !== ag.id)
    .some((row) => {
      const s = new Date(row.data_hora as string).getTime();
      const dur = (row.duracao_min as number) ?? 30;
      return startMs < s + (dur + intervaloEntreMin) * 60_000 && endMs > s;
    });
  if (conflito) {
    return { ok: false, error: 'Horario indisponivel. Escolha outro.' };
  }

  // 1. Marca antigo como reagendado
  const { error: updErr } = await admin
    .from('agendamentos')
    .update({ status: 'reagendado' })
    .eq('id', ag.id);
  if (updErr) return { ok: false, error: updErr.message };

  // 2. Cria novo agendamento
  const { data: novoRow, error: insErr } = await admin
    .from('agendamentos')
    .insert({
      tenant_id: ag.tenantId,
      profissional_id: ag.profissional.id,
      paciente_id: ag.paciente.id,
      procedimento_id: procedimentoId,
      data_hora: novaDataHoraIso,
      duracao_min: duracaoMin,
      status: 'agendado',
      reagendado_de: ag.id,
    })
    .select('id')
    .single();
  if (insErr || !novoRow) {
    // rollback
    await admin
      .from('agendamentos')
      .update({ status: ag.status })
      .eq('id', ag.id);
    return {
      ok: false,
      error: insErr?.message ?? 'Falha ao criar novo agendamento.',
    };
  }
  const novoId = novoRow.id as string;

  // Emails (best-effort) — sem linkReagendar para impedir cadeia
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const linkAgendamento = montarLinkAgendamento(baseUrl, ag.tenantSlug);

    const tplPaciente = emailReagendamento({
      pacienteNome: ag.paciente.nome,
      profissionalNome: ag.profissional.nome,
      profissionalEspecialidade: ag.profissional.especialidade,
      procedimentoNome: ag.procedimento?.nome ?? null,
      dataAnteriorIso: dataIsoFromTimestamp(ag.dataHoraIso),
      horarioAnterior: horarioFromIso(ag.dataHoraIso),
      dataNovaIso: novaDataIso,
      horarioNovo: horarioFromIso(novaDataHoraIso),
      linkAgendamento,
      logoUrl: ag.profissional.logoUrl,
    });

    if (ag.paciente.email) {
      await enviarNotificacaoEmail({
        tenantId: ag.tenantId,
        agendamentoId: novoId,
        tipo: 'reagendamento',
        destino: ag.paciente.email,
        assunto: tplPaciente.assunto,
        html: tplPaciente.html,
      });
    }

    // Email para o profissional
    const { data: profEmailRow } = await admin
      .from('profissionais')
      .select('email')
      .eq('id', ag.profissional.id)
      .maybeSingle();
    const profEmail = (profEmailRow?.email as string | null) ?? null;
    if (profEmail) {
      const html = `
        <p>O paciente <strong>${ag.paciente.nome}</strong> reagendou a consulta pelo link publico.</p>
        <p>De: ${dataIsoFromTimestamp(ag.dataHoraIso)} as ${horarioFromIso(ag.dataHoraIso)}</p>
        <p>Para: ${novaDataIso} as ${horarioFromIso(novaDataHoraIso)}</p>
      `;
      await enviarNotificacaoEmail({
        tenantId: ag.tenantId,
        agendamentoId: novoId,
        tipo: 'reagendamento',
        destino: profEmail,
        assunto: `Reagendamento: ${ag.paciente.nome}`,
        html,
      });
    }
  } catch (e) {
    console.error('[reagendarPorPaciente] erro ao enviar email:', e);
  }

  revalidatePath('/agenda');
  return {
    ok: true,
    novoAgendamentoId: novoId,
    novaDataIso,
    novaHora,
    profissionalNome: ag.profissional.nome,
  };
}
