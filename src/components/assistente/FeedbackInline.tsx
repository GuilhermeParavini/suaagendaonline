"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TAGS_NEGATIVAS = [
  "Resposta incorreta",
  "Resposta incompleta",
  "Não entendeu minha pergunta",
  "Muito lento",
  "Informação desatualizada",
];

type Estado = "idle" | "negativo_aberto" | "enviando" | "voted";

interface FeedbackInlineProps {
  historicoId: string;
  onFeedbackSent?: () => void;
}

async function enviarFeedback(payload: {
  historicoId: string;
  avaliacao: "positivo" | "negativo";
  tags?: string[];
}): Promise<void> {
  try {
    await fetch("/api/assistente/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort
  }
}

function FeedbackInline({ historicoId, onFeedbackSent }: FeedbackInlineProps) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [tagsSelecionadas, setTagsSelecionadas] = useState<Set<string>>(
    new Set(),
  );
  const [agradecimento, setAgradecimento] = useState<string | null>(null);

  const finalizar = (msg: string) => {
    setAgradecimento(msg);
    setEstado("voted");
    onFeedbackSent?.();
    window.setTimeout(() => setAgradecimento(null), 2000);
  };

  const handlePositivo = async () => {
    if (estado !== "idle") return;
    setEstado("enviando");
    await enviarFeedback({ historicoId, avaliacao: "positivo" });
    finalizar("Obrigado!");
  };

  const handleNegativoToggle = () => {
    if (estado !== "idle") return;
    setEstado("negativo_aberto");
  };

  const toggleTag = (tag: string) => {
    setTagsSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(tag)) novo.delete(tag);
      else novo.add(tag);
      return novo;
    });
  };

  const enviarNegativo = async () => {
    setEstado("enviando");
    await enviarFeedback({
      historicoId,
      avaliacao: "negativo",
      tags: Array.from(tagsSelecionadas),
    });
    finalizar("Obrigado pelo feedback!");
  };

  if (estado === "voted" && agradecimento) {
    return <p className="mt-1 text-xs text-gray-400">{agradecimento}</p>;
  }
  if (estado === "voted") return null;

  if (estado === "negativo_aberto" || estado === "enviando") {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-xs text-gray-500">O que houve?</p>
        <div className="flex flex-wrap gap-1.5">
          {TAGS_NEGATIVAS.map((tag) => {
            const ativo = tagsSelecionadas.has(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                disabled={estado === "enviando"}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  ativo
                    ? "border-teal-600 bg-teal-50 text-teal-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={enviarNegativo}
            disabled={estado === "enviando"}
            className="rounded-md bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {estado === "enviando" ? "Enviando..." : "Enviar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEstado("idle");
              setTagsSelecionadas(new Set());
            }}
            disabled={estado === "enviando"}
            className="rounded-md px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-xs text-gray-400">Essa resposta foi útil?</span>
      <button
        type="button"
        onClick={handlePositivo}
        aria-label="Foi útil"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-teal-600 transition-colors"
      >
        <ThumbsUp size={12} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleNegativoToggle}
        aria-label="Não foi útil"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors"
      >
        <ThumbsDown size={12} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

export default FeedbackInline;
