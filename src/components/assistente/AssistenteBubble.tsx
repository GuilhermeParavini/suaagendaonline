"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import AssistenteChat from "./AssistenteChat";
import { cn } from "@/lib/utils";

interface AssistenteBubbleProps {
  profissionalId: string;
  profissionalNome: string;
  plano: string;
}

const PULSE_KEY = "assistente-pulse-shown";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detectarContextoPagina(pathname: string): {
  pagina: string;
  pacienteId: string | null;
} {
  if (!pathname) return { pagina: "dashboard", pacienteId: null };
  const partes = pathname.split("/").filter(Boolean);
  const root = partes[0] ?? "";
  if (root === "pacientes") {
    const id = partes[1] ?? null;
    return {
      pagina: "pacientes",
      pacienteId: id && UUID_RE.test(id) ? id : null,
    };
  }
  if (root === "financeiro") return { pagina: "financeiro", pacienteId: null };
  if (root === "agenda") return { pagina: "agenda", pacienteId: null };
  if (root === "atendimento") return { pagina: "atendimento", pacienteId: null };
  return { pagina: "dashboard", pacienteId: null };
}

function AssistenteBubble({
  profissionalId,
  profissionalNome,
  plano,
}: AssistenteBubbleProps) {
  const [aberto, setAberto] = useState(false);
  const [pulsar, setPulsar] = useState(false);
  const pathname = usePathname() ?? "/";
  const { pagina, pacienteId } = useMemo(
    () => detectarContextoPagina(pathname),
    [pathname],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ja = window.sessionStorage.getItem(PULSE_KEY);
      if (!ja) {
        setPulsar(true);
        window.sessionStorage.setItem(PULSE_KEY, "1");
      }
    } catch {
      // ignora
    }
  }, []);

  const toggle = () => {
    setAberto((v) => !v);
    setPulsar(false);
  };

  const fechar = () => setAberto(false);

  return (
    <>
      {/* Overlay no mobile quando aberto */}
      {aberto ? (
        <button
          type="button"
          aria-label="Fechar"
          onClick={fechar}
          className="fixed inset-0 z-[60] bg-black/20 md:hidden"
        />
      ) : null}

      {/* Painel: bottom-sheet (mobile) ou floating panel (desktop) */}
      {aberto ? (
        <div
          className={cn(
            "fixed z-[60] bg-white shadow-2xl border border-gray-200 transition-transform duration-300",
            // Mobile: bottom sheet
            "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl",
            // Desktop: floating panel
            "md:inset-auto md:right-6 md:bottom-20 md:h-[560px] md:w-[400px] md:max-w-[calc(100vw-32px)] md:rounded-2xl",
          )}
        >
          <AssistenteChat
            profissionalId={profissionalId}
            profissionalNome={profissionalNome}
            plano={plano}
            pagina={pagina}
            pacienteId={pacienteId}
            onClose={fechar}
          />
        </div>
      ) : null}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={toggle}
        aria-label={aberto ? "Fechar assistente" : "Abrir assistente"}
        className={cn(
          "fixed bottom-6 right-6 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition-colors",
          "hover:bg-teal-700",
          pulsar && !aberto && "animate-pulse",
        )}
      >
        {aberto ? (
          <X size={24} strokeWidth={2} aria-hidden="true" />
        ) : (
          <MessageCircle size={24} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    </>
  );
}

export default AssistenteBubble;
