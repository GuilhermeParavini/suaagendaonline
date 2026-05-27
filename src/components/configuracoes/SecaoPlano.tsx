"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, ExternalLink, Sparkles } from "lucide-react";
import { PLANOS, type PlanoId } from "@/lib/planos";
import {
  getAssinaturaTenant,
  type AssinaturaTenant,
} from "@/actions/assinatura";
import type { PeriodoAssinatura } from "@/lib/stripe-prices";
import { cn } from "@/lib/utils";

const PLANO_IDS_ORDEM: PlanoId[] = [
  "individual",
  "equipe3",
  "equipe5",
  "clinica10",
];

const RECOMENDADO: PlanoId = "equipe3";

function brl(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default function SecaoPlano() {
  const [assinatura, setAssinatura] = useState<AssinaturaTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoAssinatura>("anual");
  const [planoEmAcao, setPlanoEmAcao] = useState<PlanoId | null>(null);
  const [abrindoPortal, setAbrindoPortal] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const r = await getAssinaturaTenant();
      if (r.ok) {
        setAssinatura(r.data);
        if (r.data.periodo) setPeriodo(r.data.periodo);
      } else {
        setErro(r.error);
      }
      setLoading(false);
    });
  }, []);

  const planoAtualId = useMemo(() => {
    if (!assinatura) return null;
    return assinatura.planoId as PlanoId | "trial" | string;
  }, [assinatura]);

  async function assinar(planoId: PlanoId) {
    setErro(null);
    setPlanoEmAcao(planoId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planoId, periodo }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErro(data.error ?? "Falha ao iniciar checkout.");
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setPlanoEmAcao(null);
    }
  }

  async function abrirPortal() {
    setErro(null);
    setAbrindoPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErro(data.error ?? "Falha ao abrir o portal.");
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setAbrindoPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Carregando assinatura…
      </div>
    );
  }

  if (!assinatura) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {erro ?? "Não foi possível carregar os dados da assinatura."}
      </div>
    );
  }

  const economiaPercentual = 25; // ~25% conforme briefing

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">
          Meu plano
        </h2>
        <p className="text-sm text-slate-500">
          Gerencie sua assinatura, troque de plano e atualize o cartão.
        </p>
      </header>

      {/* Banners de estado */}
      {assinatura.pagamentoPendente ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <div className="space-y-1 text-sm text-red-800">
            <p className="font-semibold">Pagamento pendente</p>
            <p>
              Não conseguimos cobrar sua última fatura. Atualize seu cartão
              para manter o acesso.
            </p>
            <button
              type="button"
              onClick={abrirPortal}
              disabled={abrindoPortal}
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-red-700 underline-offset-2 hover:underline disabled:opacity-60"
            >
              Atualizar cartão agora
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {assinatura.status === "trialing" &&
      assinatura.diasTrialRestantes !== null ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#99F6E4] bg-[#F0FDFA] px-4 py-3 text-sm text-[#115E59]">
          <Sparkles size={18} className="text-[#0D9488]" aria-hidden="true" />
          Seu trial expira em{" "}
          <strong>{assinatura.diasTrialRestantes} dias</strong>. Escolha um
          plano para continuar.
        </div>
      ) : null}

      {/* Card do plano atual */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Plano atual
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {assinatura.planoNome}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {assinatura.periodo === "anual"
              ? "Cobrança anual"
              : assinatura.periodo === "mensal"
                ? "Cobrança mensal"
                : assinatura.status === "trialing"
                  ? "Em período de avaliação gratuita"
                  : "Sem cobrança ativa"}
          </p>
        </div>
        {assinatura.temAssinaturaAtiva || assinatura.pagamentoPendente ? (
          <button
            type="button"
            onClick={abrirPortal}
            disabled={abrindoPortal}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {abrindoPortal ? "Abrindo…" : "Gerenciar assinatura"}
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Toggle Mensal/Anual */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {assinatura.temAssinaturaAtiva
            ? "Trocar para outro plano"
            : "Escolha um plano"}
        </p>
        <div
          role="tablist"
          aria-label="Período de cobrança"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={periodo === "mensal"}
            onClick={() => setPeriodo("mensal")}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              periodo === "mensal"
                ? "bg-[#0D9488] text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            Mensal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={periodo === "anual"}
            onClick={() => setPeriodo("anual")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors",
              periodo === "anual"
                ? "bg-[#0D9488] text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            Anual
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                periodo === "anual"
                  ? "bg-white text-[#115E59]"
                  : "bg-[#F97316]/15 text-[#F97316]",
              )}
            >
              Economize ~{economiaPercentual}%
            </span>
          </button>
        </div>
      </div>

      {/* 4 cards de plano */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANO_IDS_ORDEM.map((id) => {
          const info = PLANOS[id];
          const ehAtual = planoAtualId === id;
          const recomendado = id === RECOMENDADO;
          const preco =
            periodo === "anual" ? info.precos.anual : info.precos.mensal;

          return (
            <article
              key={id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-5",
                recomendado
                  ? "border-2 border-[#0D9488] shadow-[0_10px_30px_-10px_rgba(13,148,136,0.25)]"
                  : "border-slate-200",
              )}
            >
              {recomendado ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F97316] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                  Mais popular
                </span>
              ) : null}

              <h3 className="text-base font-semibold text-slate-900">
                {info.nome}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {info.maxProfissionais === 1
                  ? "1 profissional"
                  : `Até ${info.maxProfissionais} profissionais`}
              </p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-xs font-medium text-slate-500">R$</span>
                <span className="text-3xl font-semibold text-slate-900">
                  {preco.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xs text-slate-500">/mês</span>
              </div>

              {periodo === "anual" ? (
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  cobrado anualmente {brl(info.precos.anualTotal)} em parcela
                  única
                </p>
              ) : null}

              <ul className="mt-4 space-y-1.5 text-xs text-slate-700">
                <li className="flex items-start gap-1.5">
                  <Check
                    size={14}
                    className="mt-0.5 shrink-0 text-[#0D9488]"
                    aria-hidden="true"
                  />
                  {Math.round(info.limiteTranscricaoSegundos / 60)} min IA
                  transcrição/mês
                </li>
                <li className="flex items-start gap-1.5">
                  <Check
                    size={14}
                    className="mt-0.5 shrink-0 text-[#0D9488]"
                    aria-hidden="true"
                  />
                  {info.limiteAssistente} perguntas IA/mês
                </li>
                <li className="flex items-start gap-1.5">
                  <Check
                    size={14}
                    className="mt-0.5 shrink-0 text-[#0D9488]"
                    aria-hidden="true"
                  />
                  Todas as funcionalidades
                </li>
              </ul>

              {ehAtual && assinatura.temAssinaturaAtiva ? (
                <div className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#F0FDFA] text-sm font-semibold text-[#115E59]">
                  Plano atual
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => assinar(id)}
                  disabled={planoEmAcao !== null}
                  className={cn(
                    "mt-5 inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:opacity-60",
                    recomendado
                      ? "bg-[#0D9488] text-white hover:bg-[#115E59]"
                      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
                  )}
                >
                  {planoEmAcao === id
                    ? "Redirecionando…"
                    : ehAtual
                      ? "Reativar"
                      : "Assinar"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {erro ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      ) : null}

      <p className="text-xs text-slate-500">
        Pagamentos processados com segurança pelo Stripe. Você pode cancelar
        a qualquer momento pelo portal de gerenciamento.
      </p>
    </section>
  );
}
