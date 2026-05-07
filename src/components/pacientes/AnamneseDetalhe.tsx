"use client";

import { Download } from "lucide-react";
import type { Anamnese, CampoTemplate } from "@/actions/anamnese";
import { isoToBrDate } from "@/lib/masks";
import { cn } from "@/lib/utils";

interface AnamneseDetalheProps {
  anamnese: Anamnese;
  /** Mostra o botao "Exportar PDF" no rodape */
  showExportar?: boolean;
}

function valorVazio(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function CampoValor({
  campo,
  valor,
}: {
  campo: CampoTemplate;
  valor: unknown;
}) {
  if (valorVazio(valor)) {
    return <p className="text-sm italic text-slate-500">Não informado</p>;
  }

  switch (campo.tipo) {
    case "texto_livre":
      return (
        <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">
          {String(valor)}
        </p>
      );

    case "selecao_multipla": {
      const arr = Array.isArray(valor) ? (valor as unknown[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {arr.map((opt, i) => (
            <span
              key={`${i}-${String(opt)}`}
              className="inline-flex items-center rounded-full bg-primary-surface px-2.5 py-[3px] text-[11px] font-medium text-primary-dark"
            >
              {String(opt)}
            </span>
          ))}
        </div>
      );
    }

    case "sim_nao": {
      const b = Boolean(valor);
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-medium",
            b
              ? "bg-[#D1FAE5] text-[#065F46]"
              : "bg-slate-100 text-slate-600",
          )}
        >
          {b ? "Sim" : "Não"}
        </span>
      );
    }

    case "escala_numerica": {
      const n = typeof valor === "number" ? valor : Number(valor);
      const min = typeof campo.min === "number" ? campo.min : 0;
      const max = typeof campo.max === "number" ? campo.max : 10;
      const range = max - min || 1;
      const pct = Math.max(0, Math.min(100, ((n - min) / range) * 100));
      return (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 max-w-[160px] overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="inline-flex h-6 min-w-[34px] items-center justify-center rounded-full bg-primary-surface px-1.5 text-xs font-semibold text-primary-dark">
            {n}
          </span>
          <span className="text-[11px] text-slate-500">
            {min} – {max}
          </span>
        </div>
      );
    }

    case "data":
      return (
        <p className="text-sm text-slate-900">
          {isoToBrDate(String(valor)) || String(valor)}
        </p>
      );

    case "upload_foto": {
      const url = String(valor);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={campo.label}
            className="max-h-[120px] rounded border border-slate-200 object-contain"
          />
        </a>
      );
    }

    default:
      return <p className="text-sm text-slate-900">{String(valor)}</p>;
  }
}

function AnamneseDetalhe({
  anamnese,
  showExportar = true,
}: AnamneseDetalheProps) {
  const campos = (anamnese.template_campos ?? [])
    .slice()
    .sort((a, b) => a.ordem - b.ordem);

  if (campos.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
        Template original não encontrado.
      </div>
    );
  }

  const podeExportar = showExportar && anamnese.id && anamnese.id !== "novo";

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {campos.map((c) => {
          const valor = anamnese.dados[c.id];
          return (
            <li key={c.id} className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {c.label}
              </p>
              <CampoValor campo={c} valor={valor} />
            </li>
          );
        })}
      </ul>

      {podeExportar ? (
        <div className="flex justify-end pt-2">
          <a
            href={`/anamnese/${anamnese.id}/print?auto=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors"
          >
            <Download size={13} strokeWidth={1.5} aria-hidden="true" />
            Exportar PDF
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default AnamneseDetalhe;
