"use client";

import type { Evolucao } from "@/actions/evolucoes";

interface EvolucaoDetalheProps {
  evolucao: Evolucao;
}

function Bloco({ label, valor }: { label: string; valor: string | null }) {
  if (!valor || !valor.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">
        {valor}
      </p>
    </div>
  );
}

function EvolucaoDetalhe({ evolucao }: EvolucaoDetalheProps) {
  const semConteudo =
    !evolucao.texto?.trim() &&
    !evolucao.transcricao?.trim() &&
    !evolucao.receita?.trim() &&
    !evolucao.diagnostico?.trim() &&
    !evolucao.audio_url;

  if (semConteudo) {
    return (
      <p className="text-sm italic text-slate-400">Evolução sem conteúdo.</p>
    );
  }

  return (
    <div className="space-y-3">
      <Bloco label="Observações clínicas" valor={evolucao.texto} />
      {evolucao.audio_url ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Áudio
          </p>
          <audio
            controls
            src={evolucao.audio_url}
            className="w-full"
            preload="metadata"
          />
        </div>
      ) : null}
      <Bloco label="Transcrição" valor={evolucao.transcricao} />
      <Bloco label="Receita / Prescrição" valor={evolucao.receita} />
      <Bloco label="Diagnóstico" valor={evolucao.diagnostico} />
    </div>
  );
}

export default EvolucaoDetalhe;
