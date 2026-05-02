import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import MetricCard from "@/components/ui/MetricCard";
import StatusPill, { type StatusVariant } from "@/components/ui/StatusPill";
import Card from "@/components/ui/Card";

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
    .select("id, tenant_id")
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

      {/* Floating Action Button */}
      <button
        type="button"
        aria-label="Novo agendamento"
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary/90 transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
