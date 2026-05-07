"use client";

import { useState, useTransition } from "react";
import { Check, Star } from "lucide-react";
import { criarAvaliacao } from "@/actions/avaliacoes";
import { cn } from "@/lib/utils";

interface FormAvaliacaoProps {
  agendamentoId: string;
  profissionalNome: string;
  profissionalEspecialidade: string;
  logoUrl: string | null;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition";
const labelClass = "block text-[14px] font-medium text-slate-900";

function FormAvaliacao({
  agendamentoId,
  profissionalNome,
  profissionalEspecialidade,
  logoUrl,
}: FormAvaliacaoProps) {
  const [nota, setNota] = useState<number>(0);
  const [hoverNota, setHoverNota] = useState<number>(0);
  const [gostou, setGostou] = useState("");
  const [melhorar, setMelhorar] = useState("");
  const [recomendaria, setRecomendaria] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleEnviar = () => {
    setErro(null);
    if (nota < 1 || nota > 5) {
      setErro("Selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    startTransition(async () => {
      const r = await criarAvaliacao({
        agendamentoId,
        nota,
        gostou: gostou.trim() || undefined,
        melhorar: melhorar.trim() || undefined,
        recomendaria,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setSucesso(true);
    });
  };

  if (sucesso) {
    return (
      <div className="space-y-6 text-center pt-6">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#D1FAE5]">
          <Check
            size={32}
            strokeWidth={2.5}
            className="text-[#065F46]"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Obrigado pela sua avaliação.
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="mx-auto mb-2 max-h-[60px] w-auto object-contain"
          />
        ) : null}
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {profissionalEspecialidade}
        </p>
        <h1 className="text-xl font-semibold text-slate-900 leading-tight">
          Como foi sua consulta?
        </h1>
        <p className="text-sm text-slate-600 pt-1">
          Sua opinião ajuda {profissionalNome} a melhorar.
        </p>
      </header>

      <section className="space-y-4">
        <div className="space-y-2">
          <label className={labelClass}>
            Nota geral <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const ativo = n <= (hoverNota || nota);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNota(n)}
                  onMouseEnter={() => setHoverNota(n)}
                  onMouseLeave={() => setHoverNota(0)}
                  aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                  className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Star
                    size={36}
                    strokeWidth={1.5}
                    className={cn(
                      "transition-colors",
                      ativo
                        ? "fill-[#F59E0B] text-[#F59E0B]"
                        : "fill-transparent text-slate-300",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>O que mais gostou?</label>
          <textarea
            rows={3}
            maxLength={500}
            value={gostou}
            onChange={(e) => setGostou(e.target.value)}
            placeholder="Opcional"
            className={`${inputClass} resize-y`}
          />
          <p className="text-[11px] text-slate-500">
            {gostou.length}/500
          </p>
        </div>

        <div className="space-y-1">
          <label className={labelClass}>O que poderia melhorar?</label>
          <textarea
            rows={3}
            maxLength={500}
            value={melhorar}
            onChange={(e) => setMelhorar(e.target.value)}
            placeholder="Opcional"
            className={`${inputClass} resize-y`}
          />
          <p className="text-[11px] text-slate-500">
            {melhorar.length}/500
          </p>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Recomendaria para um amigo?</label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setRecomendaria(true)}
              className={cn(
                "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                recomendaria === true
                  ? "bg-primary text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Sim
            </button>
            <button
              type="button"
              onClick={() => setRecomendaria(false)}
              className={cn(
                "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                recomendaria === false
                  ? "bg-slate-700 text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Não
            </button>
          </div>
        </div>

        {erro ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {erro}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleEnviar}
          disabled={isPending || nota < 1}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Enviando..." : "Enviar avaliação"}
        </button>
      </section>
    </div>
  );
}

export default FormAvaliacao;
