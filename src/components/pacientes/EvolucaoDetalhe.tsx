"use client";

import Link from "next/link";
import { FileText, Home } from "lucide-react";
import type { Evolucao } from "@/actions/evolucoes";

interface EvolucaoDetalheProps {
  evolucao: Evolucao;
}

function Bloco({ label, valor }: { label: string; valor: string | null }) {
  if (!valor || !valor.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
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
    !evolucao.plano_cuidados?.trim() &&
    !evolucao.audio_url;

  if (semConteudo) {
    return (
      <p className="text-sm italic text-slate-500">Evolução sem conteúdo.</p>
    );
  }

  return (
    <div className="space-y-3">
      <Bloco label="Observações clínicas" valor={evolucao.texto} />
      {evolucao.audio_url ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
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
      <Bloco label="Plano de cuidados em casa" valor={evolucao.plano_cuidados} />

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={`/relatorio-clinico/${evolucao.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors"
        >
          <FileText size={13} strokeWidth={1.5} aria-hidden="true" />
          Relatorio clinico
        </Link>
        {evolucao.plano_cuidados?.trim() ? (
          <Link
            href={`/plano-cuidados/${evolucao.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors"
          >
            <Home size={13} strokeWidth={1.5} aria-hidden="true" />
            Plano de cuidados
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default EvolucaoDetalhe;
