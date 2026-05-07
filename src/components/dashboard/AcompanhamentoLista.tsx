"use client";

import { useState, useTransition } from "react";
import { Check, MessageCircle } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import {
  marcarAcompanhado,
  type PacienteAcompanhamento,
} from "@/actions/followup";
import { capitalizeNome } from "@/lib/email-templates";

interface AcompanhamentoListaProps {
  inicial: PacienteAcompanhamento[];
  profissionalNome: string;
  clinicaNome: string;
}

function montarMensagemWhats(
  pacienteNome: string,
  profissionalNome: string,
  clinicaNome: string,
): string {
  const nome = pacienteNome.split(" ")[0] ?? pacienteNome;
  return `Olá ${nome}, aqui é ${profissionalNome} da ${clinicaNome}. Como você está se sentindo após a consulta de ontem? Se precisar de algo, estou à disposição.`;
}

function AcompanhamentoLista({
  inicial,
  profissionalNome,
  clinicaNome,
}: AcompanhamentoListaProps) {
  const [pacientes, setPacientes] = useState(inicial);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (pacientes.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500">
          Nenhum paciente para acompanhar.
        </p>
      </Card>
    );
  }

  const handleAcompanhar = (id: string) => {
    setErro(null);
    startTransition(async () => {
      const r = await marcarAcompanhado(id);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setPacientes((prev) => prev.filter((p) => p.agendamentoId !== id));
    });
  };

  const handleWhatsApp = (p: PacienteAcompanhamento) => {
    const tel = (p.telefone ?? "").replace(/\D/g, "");
    if (!tel) {
      setErro("Paciente sem telefone cadastrado.");
      return;
    }
    const numero = tel.startsWith("55") ? tel : `55${tel}`;
    const msg = montarMensagemWhats(p.nome, profissionalNome, clinicaNome);
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-2">
      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}
      <ul className="space-y-2">
        {pacientes.map((p) => (
          <li key={p.agendamentoId}>
            <Card className="flex items-center gap-3">
              <Avatar
                name={capitalizeNome(p.nome)}
                className="h-10 w-10 text-sm shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {capitalizeNome(p.nome)}
                </p>
                {p.procedimentoNome ? (
                  <p className="text-xs text-slate-500 truncate">
                    {p.procedimentoNome}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleWhatsApp(p)}
                  aria-label={`WhatsApp para ${p.nome}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1ebe5a] transition-colors"
                >
                  <MessageCircle
                    size={13}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => handleAcompanhar(p.agendamentoId)}
                  disabled={isPending}
                  aria-label={`Marcar ${p.nome} como acompanhado`}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors disabled:opacity-50"
                >
                  <Check size={13} strokeWidth={1.5} aria-hidden="true" />
                  Acompanhado
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AcompanhamentoLista;
