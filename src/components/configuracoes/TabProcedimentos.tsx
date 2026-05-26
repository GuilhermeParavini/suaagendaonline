"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toggleProcedimento } from "@/actions/configuracoes";
import type { Procedimento } from "@/lib/configuracoes-types";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";
import FormProcedimento from "./FormProcedimento";

interface TabProcedimentosProps {
  procedimentos: Procedimento[];
  onChanged: () => void;
}

function TabProcedimentos({
  procedimentos,
  onChanged,
}: TabProcedimentosProps) {
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Procedimento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const abrirNovo = () => {
    setEditando(null);
    setOpen(true);
  };

  const abrirEditar = (p: Procedimento) => {
    setEditando(p);
    setOpen(true);
  };

  const handleToggle = (p: Procedimento) => {
    setErro(null);
    startTransition(async () => {
      const result = await toggleProcedimento(p.id, !p.ativo);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      onChanged();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Cadastre os procedimentos que você oferece. Pacientes escolhem um
          deles no agendamento online.
        </p>
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors shrink-0"
        >
          <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
          Novo
        </button>
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      {procedimentos.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">
            Nenhum procedimento cadastrado.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {procedimentos.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-3 px-3 py-3 sm:px-4",
                !p.ativo && "opacity-60",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {p.nome}
                </p>
                <p className="text-xs text-slate-500">
                  {p.duracao_min} min
                  {p.valor !== null
                    ? ` · ${formatCurrency(p.valor)}`
                    : ""}
                </p>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.ativo}
                  onChange={() => handleToggle(p)}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-slate-300 text-primary-text focus:ring-primary/40"
                />
                <span className="text-xs text-slate-600">Ativo</span>
              </label>

              <button
                type="button"
                onClick={() => abrirEditar(p)}
                aria-label={`Editar ${p.nome}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormProcedimento
        open={open}
        onOpenChange={setOpen}
        procedimento={editando}
        onSaved={onChanged}
      />
    </div>
  );
}

export default TabProcedimentos;
