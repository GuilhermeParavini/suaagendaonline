"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Check, Mail, UserPlus } from "lucide-react";
import { aceitarConvite } from "@/actions/convites";
import { cn } from "@/lib/utils";

interface ConviteData {
  id: string;
  nome: string;
  email: string;
  role: string;
  clinica: string;
  convidadoPor: string | null;
  expiraEm: string;
  status: "pendente" | "aceito" | "cancelado" | "expirado";
}

interface ConviteFlowProps {
  token: string;
  convite: ConviteData;
  userEmail: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador(a)",
  profissional: "Profissional",
  secretaria: "Secretária",
};

function ConviteFlow({ token, convite, userEmail }: ConviteFlowProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ativo = convite.status === "pendente";
  const emailBate =
    !!userEmail && userEmail.toLowerCase() === convite.email.toLowerCase();

  const handleAceitar = () => {
    setErro(null);
    startTransition(async () => {
      const r = await aceitarConvite({ token });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setSucesso(true);
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 800);
    });
  };

  if (sucesso) {
    return (
      <div className="space-y-6 text-center pt-6">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#D1FAE5]">
          <Check
            size={32}
            strokeWidth={2.5}
            className="text-[#065F46]"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">
            Convite aceito
          </h1>
          <p className="text-sm text-slate-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Convite
        </p>
        <h1 className="text-xl font-semibold text-slate-900 leading-tight">
          {convite.clinica}
        </h1>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-surface text-primary-dark">
            <Building2 size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {convite.nome}
            </p>
            <p className="text-xs text-slate-500">
              Função:{" "}
              <strong className="text-slate-700">
                {ROLE_LABEL[convite.role] ?? convite.role}
              </strong>
            </p>
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Mail
            size={12}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mr-1 inline-block"
          />
          {convite.email}
        </div>

        {convite.convidadoPor ? (
          <p className="text-xs text-slate-500">
            Convidado(a) por{" "}
            <strong className="text-slate-700">{convite.convidadoPor}</strong>
          </p>
        ) : null}
      </div>

      {!ativo ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-0.5 text-amber-600"
            />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {convite.status === "expirado"
                  ? "Este convite expirou."
                  : convite.status === "cancelado"
                    ? "Este convite foi cancelado."
                    : "Este convite já foi aceito."}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Peça um novo convite ao administrador da clínica.
              </p>
            </div>
          </div>
        </div>
      ) : !userEmail ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Para aceitar o convite, crie sua conta usando o e-mail{" "}
            <strong className="text-slate-900">{convite.email}</strong>.
          </p>
          <Link
            href={`/cadastro?convite=${token}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition-colors"
          >
            <UserPlus size={14} strokeWidth={1.5} aria-hidden="true" />
            Criar conta
          </Link>
          <Link
            href={`/login?convite=${token}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary-surface transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      ) : !emailBate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Você está logado como <strong>{userEmail}</strong>, mas o convite é
            para <strong>{convite.email}</strong>.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Faça logout e entre com a conta correta para aceitar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {erro ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleAceitar}
            disabled={isPending}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark disabled:opacity-50 transition-colors",
            )}
          >
            {isPending ? "Aceitando..." : "Aceitar convite"}
          </button>
        </div>
      )}
    </div>
  );
}

export default ConviteFlow;
