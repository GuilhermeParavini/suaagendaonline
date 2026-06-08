import Link from "next/link";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Periodo de teste terminou" };

export default function PlanoExpiradoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <Clock
            size={28}
            strokeWidth={1.5}
            className="text-amber-600"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-teal-800">
            Seu período de teste terminou
          </h1>
          <p className="text-sm text-slate-600">
            Seu trial de 14 dias expirou. Para continuar usando o Sua Agenda
            Online, escolha um plano.
          </p>
        </div>

        <Link
          href="/configuracoes"
          className="inline-flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          Ver planos
        </Link>
      </div>
    </div>
  );
}
