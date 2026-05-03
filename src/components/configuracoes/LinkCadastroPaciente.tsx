"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface LinkCadastroPacienteProps {
  slug: string;
}

function LinkCadastroPaciente({ slug }: LinkCadastroPacienteProps) {
  const [copiado, setCopiado] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/cadastro-paciente/${slug}`
      : `/cadastro-paciente/${slug}`;

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
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <p className="text-[13px] font-medium text-slate-700">
          Link de cadastro de paciente
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Envie este link para pacientes que desejam se cadastrar sem agendar.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <code className="flex-1 truncate rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopiar}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-primary bg-transparent px-3 py-2 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
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

export default LinkCadastroPaciente;
