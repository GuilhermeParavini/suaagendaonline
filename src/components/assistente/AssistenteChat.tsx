"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, X } from "lucide-react";
import type { CardSugestao as CardSugestaoData } from "@/actions/assistente-sugestoes";
import {
  parseRespostaAssistente,
  type FollowUpCard,
} from "@/lib/assistente-parser";
import CardSugestao from "./CardSugestao";
import FeedbackInline from "./FeedbackInline";
import FollowUpCards from "./FollowUpCards";
import LoadingDots from "./LoadingDots";
import MensagemChat from "./MensagemChat";
import { cn } from "@/lib/utils";

type Origem = "input_livre" | "card_inicial" | "card_follow_up";

type Mensagem = {
  id: string;
  tipo: "usuario" | "assistente";
  texto: string;
  historicoId?: string;
  followUps?: FollowUpCard[];
  timestamp: Date;
};

interface AssistenteChatProps {
  profissionalId: string;
  profissionalNome: string;
  plano: string;
  pagina?: string;
  pacienteId?: string | null;
  onClose: () => void;
}

interface SugestoesResponse {
  cards?: CardSugestaoData[];
  saudacao?: string;
  log_id?: string | null;
}

interface AssistenteResponse {
  resposta?: string;
  intencao?: string;
  funcoes?: string[];
  historico_id?: string;
  erro?: string;
  mensagem?: string;
}

function gerarId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function AssistenteChat({
  profissionalId,
  profissionalNome,
  plano,
  pagina = "dashboard",
  pacienteId = null,
  onClose,
}: AssistenteChatProps) {
  const [cards, setCards] = useState<CardSugestaoData[]>([]);
  const [saudacao, setSaudacao] = useState<string>("");
  const [logId, setLogId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [limiteAtingido, setLimiteAtingido] = useState(false);
  const [planoSemAssistente, setPlanoSemAssistente] = useState(false);
  const [inputTexto, setInputTexto] = useState("");

  const mensagensRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Carrega sugestões iniciais (recarrega ao mudar de pagina/paciente)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const params = new URLSearchParams({ pagina });
        if (pacienteId) params.set("paciente_id", pacienteId);
        const r = await fetch(
          `/api/assistente/sugestoes?${params.toString()}`,
        );
        if (!r.ok) return;
        const json = (await r.json()) as SugestoesResponse;
        if (cancelado) return;
        setCards(json.cards ?? []);
        setLogId(json.log_id ?? null);
        setSaudacao(
          json.saudacao ??
            (profissionalNome
              ? `Olá, ${profissionalNome.split(" ")[0]}!`
              : "Olá!"),
        );
      } catch {
        // ignora
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [profissionalNome, pagina, pacienteId]);

  // Auto-scroll para o fim
  useEffect(() => {
    const el = mensagensRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mensagens, loading]);

  // Auto-resize textarea (max 3 linhas)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 3 * 24; // ~3 linhas
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [inputTexto]);

  const registrarClickCard = (cardId: string) => {
    if (!logId) return;
    void fetch("/api/assistente/sugestoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_id: logId, card_id: cardId }),
    }).catch(() => {});
  };

  const enviarPergunta = async (
    texto: string,
    origem: Origem,
    cardId?: string,
  ) => {
    const conteudo = texto.trim();
    if (!conteudo || loading) return;
    setMensagens((prev) => [
      ...prev,
      {
        id: gerarId(),
        tipo: "usuario",
        texto: conteudo,
        timestamp: new Date(),
      },
    ]);
    setInputTexto("");
    setLoading(true);

    try {
      const resp = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pergunta: conteudo,
          profissional_id: profissionalId,
          pagina_atual: pagina,
          paciente_id: pacienteId,
          origem,
          card_id: cardId ?? null,
        }),
      });
      const json = (await resp.json()) as AssistenteResponse;

      if (json.erro === "limite_atingido") {
        setLimiteAtingido(true);
        setMensagens((prev) => [
          ...prev,
          {
            id: gerarId(),
            tipo: "assistente",
            texto:
              json.mensagem ??
              "Você atingiu o limite de perguntas deste mês.",
            timestamp: new Date(),
          },
        ]);
        return;
      }
      if (json.erro === "plano_sem_assistente") {
        setPlanoSemAssistente(true);
        setMensagens((prev) => [
          ...prev,
          {
            id: gerarId(),
            tipo: "assistente",
            texto:
              json.mensagem ??
              "O assistente não está disponível no seu plano.",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const respostaBruta =
        json.resposta ?? "Não consegui responder agora. Tente novamente.";
      const parsed = parseRespostaAssistente(respostaBruta);

      setMensagens((prev) => [
        ...prev,
        {
          id: gerarId(),
          tipo: "assistente",
          texto: parsed.texto || respostaBruta,
          historicoId: json.historico_id,
          followUps: parsed.followUps,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMensagens((prev) => [
        ...prev,
        {
          id: gerarId(),
          tipo: "assistente",
          texto:
            "Falha de conexão. Verifique sua internet e tente novamente.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClickCard = (card: CardSugestaoData) => {
    registrarClickCard(card.id);
    void enviarPergunta(card.pergunta_formatada, "card_inicial", card.id);
  };

  const handleClickFollowUp = (pergunta: string) => {
    void enviarPergunta(pergunta, "card_follow_up");
  };

  const handleSubmit = () => {
    void enviarPergunta(inputTexto, "input_livre");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const semMensagens = mensagens.length === 0;
  const podeEnviar = !limiteAtingido && !planoSemAssistente;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">Assistente</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
            <Sparkles size={10} strokeWidth={2} aria-hidden="true" />
            IA
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar assistente"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      {/* Mensagens */}
      <div
        ref={mensagensRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {semMensagens ? (
          <>
            <p className="text-base font-semibold text-gray-900">
              {saudacao || "Olá!"}
            </p>
            <p className="text-sm text-gray-500">
              Como posso ajudar hoje? Aqui vão algumas sugestões:
            </p>
            <div className="space-y-2">
              {cards.map((c) => (
                <CardSugestao
                  key={c.id}
                  card={c}
                  onClick={handleClickCard}
                />
              ))}
            </div>
          </>
        ) : (
          mensagens.map((m) => (
            <div key={m.id} className="space-y-1.5">
              <MensagemChat
                tipo={m.tipo}
                texto={m.texto}
                timestamp={m.timestamp}
              />
              {m.tipo === "assistente" && m.followUps && m.followUps.length > 0 ? (
                <FollowUpCards
                  followUps={m.followUps}
                  onClick={handleClickFollowUp}
                  disabled={loading || !podeEnviar}
                />
              ) : null}
              {m.tipo === "assistente" && m.historicoId ? (
                <FeedbackInline historicoId={m.historicoId} />
              ) : null}
            </div>
          ))
        )}
        {loading ? <LoadingDots /> : null}
      </div>

      {/* Input */}
      <footer className="border-t border-gray-200 bg-white px-3 py-2 shrink-0">
        {!podeEnviar ? (
          <div className="px-1 py-2 text-sm text-gray-500">
            {planoSemAssistente
              ? "Assistente não disponível no plano atual."
              : "Limite de perguntas atingido este mês."}{" "}
            <Link
              href="/configuracoes"
              className="font-medium text-teal-700 hover:underline"
            >
              Fazer upgrade
            </Link>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte alguma coisa..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!inputTexto.trim() || loading}
              aria-label="Enviar pergunta"
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white transition-colors",
                "hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              <Send size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        )}
        <p className="mt-1 px-1 text-[10px] text-gray-400">
          Plano {plano} · Enter envia, Shift+Enter quebra linha
        </p>
      </footer>
    </div>
  );
}

export default AssistenteChat;
