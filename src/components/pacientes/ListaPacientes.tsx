"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Search, SearchX, Users, X } from "lucide-react";
import {
  getConveniosExistentes,
  getPacientes,
  type PacienteListItem,
  type StatusTratamento,
} from "@/actions/pacientes";
import EmptyState from "@/components/ui/EmptyState";
import CardPaciente from "./CardPaciente";

interface ListaPacientesProps {
  initialPacientes: PacienteListItem[];
}

type StatusFiltro = StatusTratamento | "todos";

function ListaPacientes({ initialPacientes }: ListaPacientesProps) {
  const [query, setQuery] = useState("");
  const [convenioFiltro, setConvenioFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [convenios, setConvenios] = useState<string[]>([]);
  const [pacientes, setPacientes] = useState<PacienteListItem[]>(initialPacientes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await getConveniosExistentes();
      if (!cancelado && r.ok) setConvenios(r.data);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const result = await getPacientes(
          query,
          convenioFiltro || undefined,
          statusFiltro,
        );
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
  }, [query, convenioFiltro, statusFiltro]);

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
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="filtro-status" className="sr-only">
              Filtrar por status
            </label>
            <select
              id="filtro-status"
              value={statusFiltro}
              onChange={(e) =>
                setStatusFiltro(e.target.value as StatusFiltro)
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition"
            >
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="alta">Com alta</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          {convenios.length > 0 ? (
            <div>
              <label htmlFor="filtro-convenio" className="sr-only">
                Filtrar por convênio
              </label>
              <select
                id="filtro-convenio"
                value={convenioFiltro}
                onChange={(e) => setConvenioFiltro(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 transition"
              >
                <option value="">Todos os convênios</option>
                {convenios.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
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
            <EmptyState
              Icon={SearchX}
              titulo="Nenhum resultado"
              descricao="Tente buscar com outros termos."
            />
          ) : (
            <EmptyState
              Icon={Users}
              titulo="Nenhum paciente cadastrado"
              descricao="Cadastre seu primeiro paciente ou compartilhe o link de agendamento."
              acao={{ label: "Cadastrar paciente", href: "/pacientes/novo" }}
            />
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
