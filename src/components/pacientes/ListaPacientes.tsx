"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  getPacientes,
  type PacienteListItem,
} from "@/actions/pacientes";
import CardPaciente from "./CardPaciente";

interface ListaPacientesProps {
  initialPacientes: PacienteListItem[];
}

function ListaPacientes({ initialPacientes }: ListaPacientesProps) {
  const [query, setQuery] = useState("");
  const [pacientes, setPacientes] = useState<PacienteListItem[]>(initialPacientes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await getPacientes(query);
        if (!result.ok) {
          setError(result.error);
          setPacientes([]);
        } else {
          setError(null);
          setPacientes(result.pacientes);
        }
      });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hasQuery = query.trim().length > 0;
  const isEmpty = pacientes.length === 0;

  return (
    <div className="space-y-4 pb-20">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
            Pacientes
          </h1>
          <Link
            href="/pacientes/novo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Novo paciente</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        </div>

        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar paciente"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition"
          />
          {hasQuery ? (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <section
        aria-busy={isPending}
        aria-live="polite"
        className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : isEmpty ? (
          hasQuery ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
              <p className="text-sm text-slate-500">
                Nenhum paciente encontrado para &quot;{query.trim()}&quot;.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center space-y-3">
              <p className="text-sm text-slate-500">
                Nenhum paciente cadastrado.
              </p>
              <Link
                href="/pacientes/novo"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
                Cadastrar primeiro paciente
              </Link>
            </div>
          )
        ) : (
          <ul className="space-y-2">
            {pacientes.map((p) => (
              <CardPaciente key={p.id} paciente={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ListaPacientes;
