"use client";

import { useEffect, useState } from "react";
import { Lock, Mic, Sparkles } from "lucide-react";
import {
  getUsoTranscricao,
  type UsoTranscricao,
} from "@/actions/transcricao";
import { getInfoPlano } from "@/lib/planos";
import { cn } from "@/lib/utils";

interface SecaoMeuPlanoProps {
  plano: string;
  trialExpiraEm: string | null;
}

function formatarPreco(valor: number): string {
  if (valor === 0) return "R$ 0";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  const fim = new Date(iso).getTime();
  if (!Number.isFinite(fim)) return null;
  const agora = Date.now();
  const diff = Math.ceil((fim - agora) / (1000 * 60 * 60 * 24));
  return diff;
}

function SecaoMeuPlano({ plano, trialExpiraEm }: SecaoMeuPlanoProps) {
  const [uso, setUso] = useState<UsoTranscricao | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await getUsoTranscricao();
      if (!cancelado && r.ok) setUso(r.data);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const info = getInfoPlano(plano);
  const isTrial = plano === "trial";
  const isEssencial = plano === "essencial";
  const dias = isTrial ? diasRestantes(trialExpiraEm) : null;

  const cor = !uso
    ? "bg-slate-200"
    : uso.percentual >= 80
      ? "bg-red-500"
      : uso.percentual >= 50
        ? "bg-amber-500"
        : "bg-primary";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Meu plano</h2>
          <p className="text-xs text-slate-500">
            Plano atual e uso de transcrição
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Em breve"
          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 cursor-not-allowed"
        >
          Alterar plano
        </button>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {info.nome}
              </p>
              {isTrial ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-surface px-2 py-0.5 text-[10px] font-medium text-primary-dark">
                  <Sparkles size={10} strokeWidth={1.5} aria-hidden="true" />
                  Em teste
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-medium text-[#065F46]">
                  Ativo
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {info.preco === 0
                ? "Período de teste gratuito"
                : `${formatarPreco(info.preco)} / mês`}
            </p>
          </div>
        </div>

        {isTrial && dias !== null ? (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {dias > 0
              ? `Seu período de teste expira em ${dias} ${dias === 1 ? "dia" : "dias"}.`
              : "Seu período de teste expirou."}
          </p>
        ) : null}

        {isEssencial ? (
          <p className="mt-3 rounded border border-primary/30 bg-primary-surface px-3 py-2 text-xs text-primary-dark">
            Faça upgrade para usar transcrição de áudio nas evoluções e
            anamneses.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          {info.limiteTranscricaoSegundos > 0 ? (
            <Mic
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-primary"
            />
          ) : (
            <Lock
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-slate-400"
            />
          )}
          <p className="text-[13px] font-medium text-slate-700">
            Transcrição de áudio
          </p>
        </div>

        {info.limiteTranscricaoSegundos === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Não disponível no plano {info.nome}.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full transition-all", cor)}
                style={{
                  width: `${uso ? Math.max(2, Math.round(uso.percentual)) : 0}%`,
                }}
              />
            </div>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">
                  {uso?.minutosUsados ?? 0}
                </span>{" "}
                de {Math.floor(info.limiteTranscricaoSegundos / 60)} min usados
                este mês
              </p>
              <p className="text-slate-500">
                {uso ? `${Math.round(uso.percentual)}%` : "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default SecaoMeuPlano;
