"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import type { UsoTranscricao } from "@/actions/transcricao";

interface BannerUsoTranscricaoProps {
  uso: UsoTranscricao;
}

function BannerUsoTranscricao({ uso }: BannerUsoTranscricaoProps) {
  const [oculto, setOculto] = useState(true);

  const chave = `bannerUsoTranscricaoFechado-${uso.plano}`;
  const mostrar =
    uso.limiteSegundos > 0 && uso.percentual >= 80 && !uso.excedeu;

  useEffect(() => {
    if (!mostrar) {
      setOculto(true);
      return;
    }
    const fechado =
      typeof window !== "undefined" && sessionStorage.getItem(chave) === "1";
    setOculto(fechado);
  }, [chave, mostrar]);

  if (!mostrar || oculto) return null;

  const handleFechar = () => {
    if (typeof window !== "undefined") sessionStorage.setItem(chave, "1");
    setOculto(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
      <AlertTriangle
        size={16}
        strokeWidth={1.5}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-amber-600"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          Você já usou {Math.round(uso.percentual)}% do limite de transcrição
          deste mês ({uso.minutosUsados} de {uso.minutosLimite} min)
        </p>
        <Link
          href="/configuracoes"
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-900 hover:underline"
        >
          Ver detalhes
        </Link>
      </div>
      <button
        type="button"
        onClick={handleFechar}
        aria-label="Fechar aviso"
        className="rounded p-1 text-amber-700 hover:bg-amber-100"
      >
        <X size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}

export default BannerUsoTranscricao;
