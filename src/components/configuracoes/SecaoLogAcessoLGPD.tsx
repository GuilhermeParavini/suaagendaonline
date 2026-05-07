"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, FileLock2 } from "lucide-react";
import {
  listarLogsAcesso,
  type LogAcessoItem,
  type ProfissionalOpcaoLog,
} from "@/actions/log-acesso";
import { cn } from "@/lib/utils";

const ACAO_LABEL: Record<string, string> = {
  visualizar_paciente: "Visualizou paciente",
  editar_paciente: "Editou paciente",
  exportar_pdf: "Exportou PDF",
  visualizar_evolucao: "Acessou evolucao",
  exportar_dados: "Exportou dados",
};

const RECURSO_LABEL: Record<string, string> = {
  paciente: "Paciente",
  agendamento: "Agendamento",
  relatorio_clinico: "Relatorio clinico",
  atestado: "Atestado",
  plano_cuidados: "Plano de cuidados",
  relatorio_financeiro_csv: "Relatorio financeiro (CSV)",
};

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rotuloAcao(a: string): string {
  return ACAO_LABEL[a] ?? a;
}

function rotuloRecurso(r: string): string {
  return RECURSO_LABEL[r] ?? r;
}

interface SecaoLogAcessoLGPDProps {
  /** Role do profissional logado. Se != 'admin', a secao nao renderiza. */
  role: string;
}

function SecaoLogAcessoLGPD({ role }: SecaoLogAcessoLGPDProps) {
  const [items, setItems] = useState<LogAcessoItem[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalOpcaoLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const carregar = (pagina: number) => {
    setErro(null);
    startTransition(async () => {
      const r = await listarLogsAcesso({
        profissionalId: profissionalId || null,
        dataInicio: dataInicio || null,
        dataFim: dataFim || null,
        page: pagina,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setItems(r.data.items);
      setProfissionais(r.data.profissionais);
      setTotal(r.data.total);
      setPage(pagina);
    });
  };

  useEffect(() => {
    if (role !== "admin") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (role !== "admin") return null;

  const totalPaginas = Math.max(1, Math.ceil(total / 100));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <header className="flex items-start gap-2">
        <FileLock2
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-primary-text"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            Log de acesso
          </h2>
          <p className="text-xs text-slate-500">
            Registro de acessos a dados sensiveis conforme LGPD. Visivel apenas
            para administradores.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="block text-[12px] font-medium text-slate-700">
            Profissional
          </label>
          <select
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
          >
            <option value="">Todos</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[12px] font-medium text-slate-700">
            De
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[12px] font-medium text-slate-700">
            Ate
          </label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => carregar(1)}
          disabled={isPending}
          className="rounded bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {isPending ? "Buscando..." : "Aplicar filtros"}
        </button>
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Quando</th>
              <th className="px-3 py-2 font-medium">Profissional</th>
              <th className="px-3 py-2 font-medium">Acao</th>
              <th className="px-3 py-2 font-medium">Recurso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-xs text-slate-500"
                >
                  Nenhum acesso registrado neste filtro.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="text-[13px] text-slate-700">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {formatarData(it.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    {it.profissional?.nome ?? "—"}
                  </td>
                  <td className="px-3 py-2">{rotuloAcao(it.acao)}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {rotuloRecurso(it.recurso)}
                    {it.recurso_id ? (
                      <span className="ml-1 text-[11px] text-slate-400">
                        #{it.recurso_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {total} {total === 1 ? "registro" : "registros"} · pagina {page} de{" "}
          {totalPaginas}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => carregar(page - 1)}
            disabled={isPending || page <= 1}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" />
            Anterior
          </button>
          <button
            type="button"
            onClick={() => carregar(page + 1)}
            disabled={isPending || page >= totalPaginas}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            Proxima
            <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default SecaoLogAcessoLGPD;
