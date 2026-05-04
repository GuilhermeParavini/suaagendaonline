import { redirect } from "next/navigation";
import { Heart, Star } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import MetricCard from "@/components/ui/MetricCard";
import StatusPill, { type StatusVariant } from "@/components/ui/StatusPill";
import Card from "@/components/ui/Card";
import NovoAgendamentoFab from "@/components/dashboard/NovoAgendamentoFab";
import AcompanhamentoLista from "@/components/dashboard/AcompanhamentoLista";
import {
  getPacientesParaAcompanhar,
  type PacienteAcompanhamento,
} from "@/actions/followup";
import { cn } from "@/lib/utils";

const currencyBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isStatusVariant = (s: string): s is StatusVariant =>
  s === "agendado" ||
  s === "confirmado" ||
  s === "em_atendimento" ||
  s === "concluido" ||
  s === "faltou";

interface AgendamentoRow {
  id: string;
  data_hora: string;
  status: string;
  pacientes: { nome: string } | { nome: string }[] | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profissionais")
    .select("id, tenant_id, nome, mostrar_acompanhamento")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!prof) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <Card>
          <p className="text-sm text-slate-500">
            Perfil profissional ainda não configurado.
          </p>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const [
    { count: consultasHoje },
    { count: confirmados },
    { count: pendentes },
    { data: receitas },
    { data: proximos },
  ] = await Promise.all([
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", prof.id)
      .gte("data_hora", todayStart)
      .lte("data_hora", todayEnd),
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", prof.id)
      .eq("status", "confirmado")
      .gte("data_hora", todayStart)
      .lte("data_hora", todayEnd),
    admin
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("profissional_id", prof.id)
      .eq("status", "agendado")
      .gte("data_hora", todayStart)
      .lte("data_hora", todayEnd),
    admin
      .from("financeiro")
      .select("valor")
      .eq("tenant_id", prof.tenant_id)
      .eq("tipo", "receita")
      .gte("data_lancamento", monthStart)
      .lte("data_lancamento", monthEnd),
    admin
      .from("agendamentos")
      .select("id, data_hora, status, pacientes(nome)")
      .eq("profissional_id", prof.id)
      .gte("data_hora", now.toISOString())
      .order("data_hora", { ascending: true })
      .limit(5),
  ]);

  const { data: avalRows } = await admin
    .from("avaliacoes")
    .select("id, nota, created_at, paciente_id, pacientes(nome)")
    .eq("profissional_id", prof.id)
    .order("created_at", { ascending: false });
  const avalLista = (avalRows ?? []) as Array<{
    id: string;
    nota: number;
    created_at: string;
    pacientes: { nome: string } | { nome: string }[] | null;
  }>;
  const avalTotal = avalLista.length;
  const avalMedia =
    avalTotal > 0
      ? avalLista.reduce((acc, r) => acc + (r.nota ?? 0), 0) / avalTotal
      : 0;
  const avalRecentes = avalLista.slice(0, 3).map((r) => {
    const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
    return {
      id: r.id,
      nota: r.nota,
      data: format(new Date(r.created_at), "dd MMM yyyy", { locale: ptBR }),
      paciente: (pac?.nome as string | null) ?? "Paciente",
    };
  });

  const mostrarAcompanhamento =
    (prof.mostrar_acompanhamento as boolean | null) === false ? false : true;

  let acompanhamentoLista: PacienteAcompanhamento[] = [];
  if (mostrarAcompanhamento) {
    const r = await getPacientesParaAcompanhar();
    if (r.ok) acompanhamentoLista = r.data;
  }

  const { data: tenantInfo } = await admin
    .from("tenants")
    .select("nome_empresa")
    .eq("id", prof.tenant_id)
    .maybeSingle();
  const clinicaNome =
    (tenantInfo?.nome_empresa as string | null) ?? "Sua clínica";
  const profissionalNome = (prof.nome as string | null) ?? "Profissional";

  const receitaMes = (receitas ?? []).reduce(
    (sum, r: { valor: number | string }) => sum + Number(r.valor ?? 0),
    0,
  );

  const proximosLista = (proximos as AgendamentoRow[] | null) ?? [];

  return (
    <div className="space-y-6 relative">
      {/* Metric Cards Grid 2x2 */}
      <section className="grid grid-cols-2 gap-3">
        <MetricCard label="Consultas hoje" value={consultasHoje ?? 0} />
        <MetricCard label="Confirmados" value={confirmados ?? 0} />
        <MetricCard label="Pendentes" value={pendentes ?? 0} />
        <MetricCard label="Receita do mês" value={currencyBRL(receitaMes)} />
      </section>

      {/* Próximos agendamentos */}
      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold text-slate-900">
          Próximos agendamentos
        </h2>

        {proximosLista.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Nenhum agendamento hoje.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {proximosLista.map((ag) => {
              const paciente = Array.isArray(ag.pacientes)
                ? ag.pacientes[0]
                : ag.pacientes;
              const dt = new Date(ag.data_hora);
              const horario = format(dt, "HH:mm");
              const data = format(dt, "dd MMM", { locale: ptBR });
              const status: StatusVariant = isStatusVariant(ag.status)
                ? ag.status
                : "agendado";

              return (
                <li key={ag.id}>
                  <Card className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-center justify-center w-14 shrink-0">
                        <span className="text-base font-semibold text-slate-900 leading-tight">
                          {horario}
                        </span>
                        <span className="text-[11px] text-slate-500 leading-tight">
                          {data}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {paciente?.nome ?? "Paciente"}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={status} />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-slate-900">
            Avaliações
          </h2>
          {avalTotal > 0 ? (
            <span className="text-xs text-slate-500">
              {avalTotal} {avalTotal === 1 ? "avaliação" : "avaliações"}
            </span>
          ) : null}
        </div>

        {avalTotal === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              Nenhuma avaliação recebida ainda.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            <Card className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={18}
                    strokeWidth={1.5}
                    className={cn(
                      n <= Math.round(avalMedia)
                        ? "fill-[#F59E0B] text-[#F59E0B]"
                        : "fill-transparent text-slate-300",
                    )}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <p className="text-base font-semibold text-slate-900">
                {avalMedia.toFixed(1)}
              </p>
              <p className="text-xs text-slate-500">
                média de {avalTotal} {avalTotal === 1 ? "avaliação" : "avaliações"}
              </p>
            </Card>

            <ul className="space-y-2">
              {avalRecentes.map((a) => (
                <li key={a.id}>
                  <Card className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {a.paciente}
                      </p>
                      <p className="text-[11px] text-slate-500">{a.data}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={14}
                          strokeWidth={1.5}
                          className={cn(
                            n <= a.nota
                              ? "fill-[#F59E0B] text-[#F59E0B]"
                              : "fill-transparent text-slate-300",
                          )}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {mostrarAcompanhamento ? (
        <section className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <Heart
                size={18}
                strokeWidth={1.5}
                className="text-primary"
                aria-hidden="true"
              />
              <h2 className="text-[18px] font-semibold text-slate-900">
                Acompanhamento
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pacientes atendidos ontem
            </p>
          </div>

          <AcompanhamentoLista
            inicial={acompanhamentoLista}
            profissionalNome={profissionalNome}
            clinicaNome={clinicaNome}
          />
        </section>
      ) : null}

      <NovoAgendamentoFab />
    </div>
  );
}
