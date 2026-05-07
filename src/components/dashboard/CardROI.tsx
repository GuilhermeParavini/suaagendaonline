import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Heart,
  TrendingUp,
} from "lucide-react";
import type { ROIDados } from "@/actions/roi";
import { cn } from "@/lib/utils";

interface CardROIProps {
  dados: ROIDados;
}

function formatCurrencyBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(v: number, casas: number = 1): string {
  const fixed = v.toFixed(casas).replace(".", ",");
  return `${fixed}%`;
}

function formatHoras(min: number): string {
  if (min < 60) return `${min} min`;
  const horas = min / 60;
  if (horas < 10) return `${horas.toFixed(1).replace(".", ",")}h`;
  return `${Math.round(horas)}h`;
}

function VariacaoBadge({
  variacaoPct,
  invertido = false,
}: {
  variacaoPct: number | null;
  /** Quando true, queda e positiva (ex: taxa de falta caiu = bom). */
  invertido?: boolean;
}) {
  if (variacaoPct === null) {
    return (
      <span className="text-[11px] text-slate-500">sem comparativo</span>
    );
  }
  const subiu = variacaoPct > 0.5;
  const caiu = variacaoPct < -0.5;
  const positivo = invertido ? caiu : subiu;
  const negativo = invertido ? subiu : caiu;

  if (!subiu && !caiu) {
    return (
      <span className="text-[11px] text-slate-500">estavel vs mes anterior</span>
    );
  }

  const Icon = subiu ? ArrowUpRight : ArrowDownRight;
  const cor = positivo
    ? "text-[#16A34A]"
    : negativo
      ? "text-[#DC2626]"
      : "text-slate-500";

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", cor)}>
      <Icon size={11} strokeWidth={2} aria-hidden="true" />
      {Math.abs(variacaoPct).toFixed(1).replace(".", ",")}% vs mes anterior
    </span>
  );
}

function CardROI({ dados }: CardROIProps) {
  if (!dados.dadosSuficientes) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <header className="flex items-center gap-2">
          <TrendingUp
            size={18}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-primary-text"
          />
          <h2 className="text-[16px] font-semibold text-slate-900">
            Seu retorno este mes
          </h2>
        </header>
        <p className="text-sm text-slate-600">
          Ainda nao temos dados suficientes para calcular seu retorno. Continue
          atendendo — voltamos com numeros assim que voce tiver mais movimento
          no mes.
        </p>
      </section>
    );
  }

  const ganho = dados.retornoFollowup.ganhoPct;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <header className="flex items-center gap-2">
        <TrendingUp
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-primary-text"
        />
        <h2 className="text-[16px] font-semibold text-slate-900">
          Seu retorno este mes
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric
          label="Taxa de falta"
          valor={formatPct(dados.taxaFalta.atual)}
          valorClasse={
            dados.taxaFalta.atual <= 10
              ? "text-[#16A34A]"
              : dados.taxaFalta.atual <= 20
                ? "text-slate-900"
                : "text-[#DC2626]"
          }
          rodape={
            <VariacaoBadge variacaoPct={dados.taxaFalta.variacaoPct} invertido />
          }
        />

        <Metric
          icon={
            <Clock size={14} strokeWidth={1.5} aria-hidden="true" className="text-slate-500" />
          }
          label="Tempo economizado"
          valor={`~${formatHoras(dados.tempoEconomizadoMin)}`}
          valorClasse="text-primary-text"
          rodape={
            <span className="text-[11px] text-slate-500">
              {dados.detalheTempo.agendamentosOnline} agendam.,{" "}
              {dados.detalheTempo.preConsultas} pre-cons.,{" "}
              {dados.detalheTempo.transcricoes} transcr.
            </span>
          }
        />

        <Metric
          icon={
            <Heart size={14} strokeWidth={1.5} aria-hidden="true" className="text-slate-500" />
          }
          label="Retorno c/ acompanhamento"
          valor={
            ganho !== null
              ? `${ganho > 0 ? "+" : ""}${ganho.toFixed(0)}%`
              : "—"
          }
          valorClasse={
            ganho === null
              ? "text-slate-900"
              : ganho >= 0
                ? "text-[#16A34A]"
                : "text-[#DC2626]"
          }
          rodape={
            ganho !== null ? (
              <span className="text-[11px] text-slate-500">
                vs pacientes sem acompanhamento
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                aguardando dados ({dados.retornoFollowup.totalComFollowup} acomp.)
              </span>
            )
          }
        />

        <Metric
          label="Receita do mes"
          valor={formatCurrencyBRL(dados.receita.atual)}
          valorClasse={
            dados.receita.atual >= dados.receita.anterior
              ? "text-primary-text"
              : "text-slate-900"
          }
          rodape={<VariacaoBadge variacaoPct={dados.receita.variacaoPct} />}
        />
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  valor,
  valorClasse,
  rodape,
}: {
  icon?: React.ReactNode;
  label: string;
  valor: string;
  valorClasse?: string;
  rodape?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-3 space-y-1">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <p className={cn("text-[24px] font-semibold leading-tight", valorClasse)}>
        {valor}
      </p>
      <div>{rodape}</div>
    </div>
  );
}

export default CardROI;
