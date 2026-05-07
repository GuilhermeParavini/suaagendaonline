"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

// ============================================================
// Tipos
// ============================================================

export interface ROIComparativo {
  atual: number;
  anterior: number;
  /** Variacao percentual: (atual - anterior) / anterior * 100. Null quando anterior=0. */
  variacaoPct: number | null;
}

export interface ROIRetornoFollowup {
  /** Pacientes que tiveram aftercare e retornaram a agendar. */
  retornaramComFollowup: number;
  /** Pacientes que tiveram aftercare. */
  totalComFollowup: number;
  /** Pacientes sem aftercare que retornaram. */
  retornaramSemFollowup: number;
  /** Total de pacientes sem aftercare na janela. */
  totalSemFollowup: number;
  /** Diferenca percentual: taxa com followup / taxa sem followup. Null se dados insuficientes. */
  ganhoPct: number | null;
}

export interface ROIDados {
  mesAno: string;
  totalAgendamentosMes: number;
  taxaFalta: ROIComparativo; // 0..100
  tempoEconomizadoMin: number;
  detalheTempo: {
    agendamentosOnline: number;
    preConsultas: number;
    transcricoes: number;
  };
  receita: ROIComparativo; // BRL
  retornoFollowup: ROIRetornoFollowup;
  /** True quando dados sao representativos (>= 5 agendamentos no mes). */
  dadosSuficientes: boolean;
}

export type CalcularROIResult =
  | { ok: true; data: ROIDados }
  | { ok: false; error: string };

// ============================================================
// Helpers
// ============================================================

function mesAtualAnoMes(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseMesAno(v: string | undefined): string {
  if (!v) return mesAtualAnoMes();
  return /^\d{4}-\d{2}$/.test(v) ? v : mesAtualAnoMes();
}

function rangeMes(mesAno: string): { inicio: string; fim: string } {
  const [y, m] = mesAno.split("-").map(Number);
  const inicioDate = new Date(Date.UTC(y, m - 1, 1));
  const fimDate = new Date(Date.UTC(y, m, 1));
  return {
    inicio: inicioDate.toISOString(),
    fim: fimDate.toISOString(),
  };
}

function rangeMesIso(mesAno: string): { inicio: string; fim: string } {
  const [y, m] = mesAno.split("-").map(Number);
  const inicio = `${y}-${String(m).padStart(2, "0")}-01`;
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const fim = `${y}-${String(m).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

function mesAnterior(mesAno: string): string {
  const [y, m] = mesAno.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

// Tempos estimados em minutos por evento.
const MIN_AGENDAMENTO_ONLINE = 3;
const MIN_PRE_CONSULTA = 5;
const MIN_TRANSCRICAO = 10;

// ============================================================
// calcularROI
// ============================================================

export async function calcularROI(
  mesAno?: string,
): Promise<CalcularROIResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const tenantId = prof.tenant_id as string;
  const profId = prof.id as string;
  const periodo = parseMesAno(mesAno);
  const periodoAnterior = mesAnterior(periodo);
  const r = rangeMes(periodo);
  const rAnt = rangeMes(periodoAnterior);
  const rIso = rangeMesIso(periodo);
  const rIsoAnt = rangeMesIso(periodoAnterior);

  // ===== a) Taxa de falta =====
  const [
    { count: faltouAtual },
    { count: concluidoAtual },
    { count: faltouAnt },
    { count: concluidoAnt },
  ] = await Promise.all([
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profId)
      .eq("status", "faltou")
      .gte("data_hora", r.inicio)
      .lt("data_hora", r.fim),
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profId)
      .eq("status", "concluido")
      .gte("data_hora", r.inicio)
      .lt("data_hora", r.fim),
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profId)
      .eq("status", "faltou")
      .gte("data_hora", rAnt.inicio)
      .lt("data_hora", rAnt.fim),
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profId)
      .eq("status", "concluido")
      .gte("data_hora", rAnt.inicio)
      .lt("data_hora", rAnt.fim),
  ]);

  const baseFaltaAtual = (faltouAtual ?? 0) + (concluidoAtual ?? 0);
  const baseFaltaAnt = (faltouAnt ?? 0) + (concluidoAnt ?? 0);
  const taxaFaltaAtual =
    baseFaltaAtual > 0 ? ((faltouAtual ?? 0) / baseFaltaAtual) * 100 : 0;
  const taxaFaltaAnt =
    baseFaltaAnt > 0 ? ((faltouAnt ?? 0) / baseFaltaAnt) * 100 : 0;

  // ===== c) Tempo economizado =====
  // Agendamentos "online" = criados pelo paciente (origem != 'profissional').
  // Tabela tem coluna `origem`. Fallback: tudo conta como online se a coluna
  // nao existir — mas como a query falharia, tratamos com try/catch.
  let agendamentosOnline = 0;
  try {
    const { count } = await admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profId)
      .neq("origem", "profissional")
      .gte("data_hora", r.inicio)
      .lt("data_hora", r.fim);
    agendamentosOnline = count ?? 0;
  } catch {
    agendamentosOnline = 0;
  }

  // Pre-consultas preenchidas no mes — usar `anamneses.origem='pre_consulta'`.
  let preConsultas = 0;
  try {
    const { count } = await admin
      .from("anamneses")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("origem", "pre_consulta")
      .gte("created_at", r.inicio)
      .lt("created_at", r.fim);
    preConsultas = count ?? 0;
  } catch {
    preConsultas = 0;
  }

  // Transcricoes de audio — tabela `uso_transcricao` tem registros por uso.
  let transcricoes = 0;
  try {
    const { count } = await admin
      .from("uso_transcricao")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", r.inicio)
      .lt("created_at", r.fim);
    transcricoes = count ?? 0;
  } catch {
    transcricoes = 0;
  }

  const tempoEconomizadoMin =
    agendamentosOnline * MIN_AGENDAMENTO_ONLINE +
    preConsultas * MIN_PRE_CONSULTA +
    transcricoes * MIN_TRANSCRICAO;

  // ===== d) Receita do mes =====
  const [{ data: recRows }, { data: recAntRows }] = await Promise.all([
    admin
      .from("financeiro")
      .select("valor")
      .eq("tenant_id", tenantId)
      .eq("tipo", "receita")
      .eq("pago", true)
      .gte("data_lancamento", rIso.inicio)
      .lte("data_lancamento", rIso.fim),
    admin
      .from("financeiro")
      .select("valor")
      .eq("tenant_id", tenantId)
      .eq("tipo", "receita")
      .eq("pago", true)
      .gte("data_lancamento", rIsoAnt.inicio)
      .lte("data_lancamento", rIsoAnt.fim),
  ]);

  const somaValor = (rows: Array<{ valor: number | string }> | null) =>
    (rows ?? []).reduce((acc, x) => acc + Number(x.valor ?? 0), 0);
  const receitaAtual = somaValor(recRows as Array<{ valor: number | string }> | null);
  const receitaAnt = somaValor(
    recAntRows as Array<{ valor: number | string }> | null,
  );

  // ===== b) Retorno com followup =====
  // Pacientes que receberam aftercare nos ultimos 90 dias e voltaram a agendar
  // depois da data_prevista da tarefa.
  const noventaDiasAtras = new Date();
  noventaDiasAtras.setUTCDate(noventaDiasAtras.getUTCDate() - 90);
  const limiteAftercareIso = noventaDiasAtras.toISOString().slice(0, 10);

  const retornoFollowup: ROIRetornoFollowup = await (async () => {
    try {
      const { data: tarefas } = await admin
        .from("aftercare_tarefas")
        .select("paciente_id, data_prevista")
        .eq("tenant_id", tenantId)
        .gte("data_prevista", limiteAftercareIso);
      const lista = (tarefas ?? []) as Array<{
        paciente_id: string;
        data_prevista: string;
      }>;
      const dataPorPaciente = new Map<string, string>();
      for (const t of lista) {
        const atual = dataPorPaciente.get(t.paciente_id);
        if (!atual || t.data_prevista < atual) {
          dataPorPaciente.set(t.paciente_id, t.data_prevista);
        }
      }
      const pacIdsCom = Array.from(dataPorPaciente.keys());

      // Total de pacientes "ativos" no periodo (qualquer agendamento nos
      // ultimos 90 dias) que NAO entraram em aftercare.
      const noventa = new Date();
      noventa.setUTCDate(noventa.getUTCDate() - 90);
      const limite90Iso = noventa.toISOString();

      const { data: agsAtivos } = await admin
        .from("agendamentos")
        .select("paciente_id, data_hora, status")
        .eq("profissional_id", profId)
        .gte("data_hora", limite90Iso);
      const agsLista = (agsAtivos ?? []) as Array<{
        paciente_id: string;
        data_hora: string;
        status: string;
      }>;
      const ativosSet = new Set(agsLista.map((a) => a.paciente_id));
      const pacIdsCom_set = new Set(pacIdsCom);

      let retornaramCom = 0;
      for (const pid of pacIdsCom) {
        const dataInicio = dataPorPaciente.get(pid)!;
        const inicioIso = `${dataInicio}T00:00:00.000Z`;
        const voltou = agsLista.some(
          (a) =>
            a.paciente_id === pid &&
            a.data_hora >= inicioIso &&
            a.status !== "cancelado",
        );
        if (voltou) retornaramCom += 1;
      }
      const totalCom = pacIdsCom.length;

      const semFollowupSet = new Set<string>();
      for (const id of ativosSet) if (!pacIdsCom_set.has(id)) semFollowupSet.add(id);
      const totalSem = semFollowupSet.size;
      // "Retornar sem followup": teve >= 2 agendamentos no periodo
      let retornaramSem = 0;
      const contagemPorPac = new Map<string, number>();
      for (const a of agsLista) {
        if (!semFollowupSet.has(a.paciente_id)) continue;
        if (a.status === "cancelado") continue;
        contagemPorPac.set(
          a.paciente_id,
          (contagemPorPac.get(a.paciente_id) ?? 0) + 1,
        );
      }
      for (const c of contagemPorPac.values()) if (c >= 2) retornaramSem += 1;

      const taxaCom = totalCom > 0 ? retornaramCom / totalCom : 0;
      const taxaSem = totalSem > 0 ? retornaramSem / totalSem : 0;
      const ganhoPct =
        totalCom >= 3 && totalSem >= 3 && taxaSem > 0
          ? ((taxaCom - taxaSem) / taxaSem) * 100
          : null;

      return {
        retornaramComFollowup: retornaramCom,
        totalComFollowup: totalCom,
        retornaramSemFollowup: retornaramSem,
        totalSemFollowup: totalSem,
        ganhoPct,
      };
    } catch (e) {
      console.error("[roi] retornoFollowup:", e);
      return {
        retornaramComFollowup: 0,
        totalComFollowup: 0,
        retornaramSemFollowup: 0,
        totalSemFollowup: 0,
        ganhoPct: null,
      };
    }
  })();

  const totalAgsMes = baseFaltaAtual + (await (async () => {
    const { count } = await admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", profId)
      .in("status", ["agendado", "confirmado", "em_atendimento"])
      .gte("data_hora", r.inicio)
      .lt("data_hora", r.fim);
    return count ?? 0;
  })());

  const data: ROIDados = {
    mesAno: periodo,
    totalAgendamentosMes: totalAgsMes,
    taxaFalta: {
      atual: taxaFaltaAtual,
      anterior: taxaFaltaAnt,
      variacaoPct: variacaoPct(taxaFaltaAtual, taxaFaltaAnt),
    },
    tempoEconomizadoMin,
    detalheTempo: {
      agendamentosOnline,
      preConsultas,
      transcricoes,
    },
    receita: {
      atual: receitaAtual,
      anterior: receitaAnt,
      variacaoPct: variacaoPct(receitaAtual, receitaAnt),
    },
    retornoFollowup,
    dadosSuficientes: totalAgsMes >= 5,
  };

  return { ok: true, data };
}
