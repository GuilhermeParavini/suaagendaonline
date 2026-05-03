"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface LinkAgendamentoProps {
  slug: string;
}

function LinkAgendamento({ slug }: LinkAgendamentoProps) {
  const [copiado, setCopiado] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/agendar/${slug}`
      : `/agendar/${slug}`;

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // ignora
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary-surface p-4 space-y-3">
      <div>
        <p className="text-[13px] font-medium text-primary-dark">
          Link de agendamento
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          Compartilhe este link com seus pacientes para agendamento online.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <code className="flex-1 truncate rounded border border-primary/20 bg-white px-3 py-2 text-xs text-slate-700">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopiar}
          className="inline-flex items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
        >
          {copiado ? (
            <>
              <Check size={13} strokeWidth={2} aria-hidden="true" />
              Copiado
            </>
          ) : (
            <>
              <Copy size={13} strokeWidth={1.5} aria-hidden="true" />
              Copiar link
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default LinkAgendamento;
