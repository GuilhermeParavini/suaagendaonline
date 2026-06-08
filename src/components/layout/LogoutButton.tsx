"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  /**
   * "sidebar" — estilo do menu lateral (desktop).
   * "mobile" — estilo das linhas do sheet "Mais" (mobile).
   */
  variant?: "sidebar" | "mobile";
}

// Botao de logout. Usa a server action `logout()`, que faz signOut (limpando os
// cookies de sessao no servidor) e redireciona para /login. Por ser uma server
// action de form, o redirect server-side cuida da navegacao.
function LogoutButton({ variant = "sidebar" }: LogoutButtonProps) {
  const [saindo, setSaindo] = useState(false);

  return (
    <form action={logout} onSubmit={() => setSaindo(true)} className="w-full">
      <button
        type="submit"
        disabled={saindo}
        aria-label="Sair da conta"
        className={cn(
          "flex w-full items-center gap-3 text-sm font-medium transition-colors disabled:opacity-50",
          variant === "sidebar"
            ? "rounded px-3 py-2.5 text-slate-500 hover:bg-slate-50 hover:text-red-600"
            : "px-4 py-3 text-slate-700 hover:bg-slate-50 hover:text-red-600",
        )}
      >
        <LogOut size={20} strokeWidth={1.5} aria-hidden="true" />
        <span className="flex-1 text-left">{saindo ? "Saindo..." : "Sair"}</span>
      </button>
    </form>
  );
}

export default LogoutButton;
