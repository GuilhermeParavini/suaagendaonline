"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getAnamneses,
  getTemplates,
  type Anamnese,
  type Template,
} from "@/actions/anamnese";
import { cn } from "@/lib/utils";
import FormNovaAnamnese from "./FormNovaAnamnese";
import AnamneseDetalhe from "./AnamneseDetalhe";

interface TabAnamnesePacienteProps {
  pacienteId: string;
  onAnamneseCriada?: () => void;
}

function TabAnamnesePaciente({
  pacienteId,
  onAnamneseCriada,
}: TabAnamnesePacienteProps) {
  const [anamneses, setAnamneses] = useState<Anamnese[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const recarregar = useCallback(() => {
    setErro(null);
    startTransition(async () => {
      const [resA, resT] = await Promise.all([
        getAnamneses(pacienteId),
        getTemplates(),
      ]);
      if (!resA.ok) {
        setErro(resA.error);
        return;
      }
      if (!resT.ok) {
        setErro(resT.error);
        return;
      }
      setAnamneses(resA.data);
      setTemplates(resT.data);
    });
  }, [pacienteId]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [resA, resT] = await Promise.all([
        getAnamneses(pacienteId),
        getTemplates(),
      ]);
      if (cancelado) return;
      if (resA.ok) setAnamneses(resA.data);
      else setErro(resA.error);
      if (resT.ok) setTemplates(resT.data);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [pacienteId]);

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const ativos = templates.filter((t) => t.ativo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Registros clínicos preenchidos a partir dos templates.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={ativos.length === 0}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
          Nova anamnese
        </button>
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      {ativos.length === 0 && !carregando ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Nenhum template ativo. Crie um em Configurações &gt; Anamnese.
        </p>
      ) : null}

      {carregando ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      ) : anamneses.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <ClipboardList
            size={28}
            strokeWidth={1.5}
            className="mx-auto text-slate-300"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm text-slate-500">
            Nenhuma anamnese registrada.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {anamneses.map((a) => {
            const expandido = expandidos.has(a.id);
            const dt = new Date(a.created_at);
            const dataLabel = format(dt, "dd/MM/yyyy HH:mm", { locale: ptBR });
            return (
              <li
                key={a.id}
                className="rounded-lg border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleExpandido(a.id)}
                  className="flex w-full items-center gap-3 px-3 py-3 sm:px-4 text-left hover:bg-slate-50 transition-colors rounded-lg"
                >
                  <ClipboardList
                    size={18}
                    strokeWidth={1.5}
                    className="shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {a.template_nome ?? "Anamnese"}
                    </p>
                    <p className="text-xs text-slate-500">{dataLabel}</p>
                  </div>
                  {expandido ? (
                    <ChevronUp
                      size={16}
                      strokeWidth={1.5}
                      className="text-slate-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                      strokeWidth={1.5}
                      className="text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <div
                  className={cn(
                    "overflow-hidden border-t border-slate-100 px-3 sm:px-4 transition-all",
                    expandido ? "py-3" : "h-0 py-0",
                  )}
                >
                  {expandido ? <AnamneseDetalhe anamnese={a} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FormNovaAnamnese
        key={`form-${open ? "open" : "closed"}`}
        open={open}
        onOpenChange={setOpen}
        pacienteId={pacienteId}
        templates={templates}
        onSaved={() => {
          recarregar();
          onAnamneseCriada?.();
        }}
      />
    </div>
  );
}

export default TabAnamnesePaciente;
