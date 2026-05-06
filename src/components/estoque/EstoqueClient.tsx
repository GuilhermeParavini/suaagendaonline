"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  excluirProduto,
  getEstoque,
  type CategoriaEstoque,
  type EstoqueFiltros,
  type ProdutoEstoque,
  type TipoMovimentacao,
} from "@/actions/estoque";
import { formatCurrency } from "@/lib/masks";
import { cn } from "@/lib/utils";
import FormProduto from "./FormProduto";
import ModalMovimentacao from "./ModalMovimentacao";
import RelatorioEstoque from "./RelatorioEstoque";

type CategoriaFiltro = CategoriaEstoque | "todas";

interface ProfissionalOpcao {
  id: string;
  nome: string;
}

interface EstoqueClientProps {
  initialProdutos: ProdutoEstoque[];
  role: "admin" | "profissional" | "secretaria";
  profissionais: ProfissionalOpcao[];
  alertaInicial?: boolean;
}

const CATEGORIAS: { value: CategoriaFiltro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "descartaveis", label: "Descartaveis" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "outros", label: "Outros" },
];

const CATEGORIA_BADGE: Record<CategoriaEstoque, string> = {
  descartaveis: "bg-amber-100 text-amber-800",
  equipamentos: "bg-blue-100 text-blue-800",
  outros: "bg-slate-100 text-slate-700",
};

const CATEGORIA_LABEL: Record<CategoriaEstoque, string> = {
  descartaveis: "Descartaveis",
  equipamentos: "Equipamentos",
  outros: "Outros",
};

function fmtQtd(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function EstoqueClient({
  initialProdutos,
  role,
  profissionais,
  alertaInicial = false,
}: EstoqueClientProps) {
  const [vista, setVista] = useState<"lista" | "relatorio">("lista");
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>(initialProdutos);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaFiltro>("todas");
  const [apenasAlerta, setApenasAlerta] = useState(alertaInicial);
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [modalProdutoOpen, setModalProdutoOpen] = useState(false);
  const [produtoEdicao, setProdutoEdicao] = useState<ProdutoEstoque | null>(
    null,
  );

  const [modalMovOpen, setModalMovOpen] = useState(false);
  const [movProduto, setMovProduto] = useState<ProdutoEstoque | null>(null);
  const [movTipo, setMovTipo] = useState<TipoMovimentacao>("entrada");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recarregar = useCallback(
    (filtros: EstoqueFiltros) => {
      setError(null);
      startTransition(async () => {
        const r = await getEstoque(filtros);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setProdutos(r.data);
      });
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      recarregar({
        busca,
        categoria,
        apenasAlerta,
        profissionalId: profissionalId || undefined,
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, categoria, apenasAlerta, profissionalId]);

  const handleAbrirNovo = () => {
    setProdutoEdicao(null);
    setModalProdutoOpen(true);
  };

  const handleEditar = (p: ProdutoEstoque) => {
    setProdutoEdicao(p);
    setModalProdutoOpen(true);
  };

  const handleAbrirMov = (p: ProdutoEstoque, tipo: TipoMovimentacao) => {
    setMovProduto(p);
    setMovTipo(tipo);
    setModalMovOpen(true);
  };

  const handleExcluir = (p: ProdutoEstoque) => {
    if (!window.confirm(`Excluir o produto "${p.nome}"?`)) return;
    startTransition(async () => {
      const r = await excluirProduto(p.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      recarregar({
        busca,
        categoria,
        apenasAlerta,
        profissionalId: profissionalId || undefined,
      });
    });
  };

  const handleSaved = () => {
    recarregar({
      busca,
      categoria,
      apenasAlerta,
      profissionalId: profissionalId || undefined,
    });
  };

  const totalAlerta = produtos.filter((p) => p.alerta).length;

  return (
    <div className="space-y-5 relative pb-20">
      <header className="space-y-1">
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Estoque
        </h1>
        <p className="text-sm text-slate-500">
          {produtos.length}{" "}
          {produtos.length === 1 ? "produto" : "produtos"}
          {totalAlerta > 0 ? (
            <>
              {" - "}
              <span className="text-amber-700 font-medium">
                {totalAlerta} em alerta
              </span>
            </>
          ) : null}
        </p>
      </header>

      <Tabs.Root
        value={vista}
        onValueChange={(v) =>
          setVista(v === "relatorio" ? "relatorio" : "lista")
        }
      >
        <Tabs.List
          aria-label="Visao do estoque"
          className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-auto"
        >
          <Tabs.Trigger
            value="lista"
            className={cn(
              "flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors sm:flex-initial",
              "data-[state=active]:bg-primary-surface data-[state=active]:text-primary-dark",
              "text-slate-500 hover:text-slate-900",
            )}
          >
            Produtos
          </Tabs.Trigger>
          <Tabs.Trigger
            value="relatorio"
            className={cn(
              "flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors sm:flex-initial",
              "data-[state=active]:bg-primary-surface data-[state=active]:text-primary-dark",
              "text-slate-500 hover:text-slate-900",
            )}
          >
            <BarChart3
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="inline mr-1 -mt-0.5"
            />
            Relatorio
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {vista === "relatorio" ? (
        <RelatorioEstoque
          role={role}
          profissionais={profissionais}
          profissionalId={profissionalId}
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full rounded border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltrosAbertos((v) => !v)}
              aria-expanded={filtrosAbertos}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors",
                filtrosAbertos &&
                  "border-primary text-primary-dark bg-primary-surface",
              )}
            >
              <Filter size={14} strokeWidth={1.5} aria-hidden="true" />
              Filtros
            </button>
          </div>

          {filtrosAbertos ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[13px] font-medium text-slate-700">
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) =>
                    setCategoria(e.target.value as CategoriaFiltro)
                  }
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {role === "admin" && profissionais.length > 1 ? (
                <div className="space-y-1">
                  <label className="block text-[13px] font-medium text-slate-700">
                    Profissional
                  </label>
                  <select
                    value={profissionalId}
                    onChange={(e) => setProfissionalId(e.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="block text-[13px] font-medium text-slate-700">
                  Status
                </label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={apenasAlerta}
                    onChange={(e) => setApenasAlerta(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                  />
                  <span className="text-sm text-slate-700">
                    Apenas em alerta
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          <section
            aria-busy={isPending}
            aria-live="polite"
            className={
              isPending
                ? "opacity-60 transition-opacity"
                : "transition-opacity"
            }
          >
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : produtos.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">
                  {busca || apenasAlerta || categoria !== "todas"
                    ? "Nenhum produto encontrado com esses filtros."
                    : "Nenhum produto cadastrado ainda."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {produtos.map((p) => (
                  <li key={p.id} className="px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">
                            {p.nome}
                          </p>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium",
                              CATEGORIA_BADGE[p.categoria],
                            )}
                          >
                            {CATEGORIA_LABEL[p.categoria]}
                          </span>
                          {p.alerta ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-[2px] text-[11px] font-medium text-red-700">
                              <AlertTriangle size={11} strokeWidth={2} />
                              Alerta
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {fmtQtd(p.quantidade)} {p.unidade}
                          {" - "}
                          minimo {fmtQtd(p.quantidade_minima)}
                          {p.valor_unitario !== null
                            ? ` - ${formatCurrency(p.valor_unitario)}/un`
                            : ""}
                        </p>
                        {p.fornecedor_padrao ? (
                          <p className="text-[11px] text-slate-400">
                            Fornecedor: {p.fornecedor_padrao}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAbrirMov(p, "entrada")}
                          aria-label="Registrar entrada"
                          className="inline-flex items-center justify-center rounded p-1.5 text-[#065F46] hover:bg-emerald-50 transition-colors"
                        >
                          <ArrowUpCircle size={18} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAbrirMov(p, "saida")}
                          aria-label="Registrar saida"
                          className="inline-flex items-center justify-center rounded p-1.5 text-[#991B1B] hover:bg-red-50 transition-colors"
                        >
                          <ArrowDownCircle size={18} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditar(p)}
                          aria-label="Editar produto"
                          className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                          <Pencil size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluir(p)}
                          aria-label="Excluir produto"
                          className="inline-flex items-center justify-center rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <FormProduto
        open={modalProdutoOpen}
        onOpenChange={setModalProdutoOpen}
        onSaved={handleSaved}
        produto={produtoEdicao}
      />

      <ModalMovimentacao
        open={modalMovOpen}
        onOpenChange={setModalMovOpen}
        onMoved={handleSaved}
        produto={movProduto}
        tipoInicial={movTipo}
      />

      <button
        type="button"
        aria-label="Novo produto"
        onClick={handleAbrirNovo}
        className="fixed right-4 bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] lg:bottom-6 lg:right-6 h-14 w-14 rounded-full bg-primary text-white shadow-md hover:shadow-lg hover:bg-primary-dark transition flex items-center justify-center z-40"
      >
        <Plus size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export default EstoqueClient;
