"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Home,
  LineChart,
  Loader2,
  Package,
  Search,
  Settings,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { buscaGlobal, type ResultadoBusca } from "@/actions/busca-global";
import { cn } from "@/lib/utils";

const ICONES: Record<string, LucideIcon> = {
  User,
  Users,
  Calendar,
  Home,
  BarChart3,
  LineChart,
  Wallet,
  Settings,
  Package,
  ClipboardList,
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LABEL_GRUPO: Record<ResultadoBusca["tipo"], string> = {
  paciente: "Pacientes",
  pagina: "Paginas",
  agendamento: "Agendamentos hoje",
};

function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [carregando, startBusca] = useTransition();
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce 300ms na busca.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const t = termo.trim();
    if (t.length === 0) {
      // Limpa a lista anterior quando o termo fica vazio.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultados([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startBusca(async () => {
        const r = await buscaGlobal(t);
        setResultados(r);
        setIndiceSelecionado(0);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termo, open]);

  // Reset ao fechar.
  useEffect(() => {
    if (open) return;
    // Limpa estado quando o modal fecha — sem isso o termo persistiria entre aberturas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTermo("");
    setResultados([]);
    setIndiceSelecionado(0);
  }, [open]);

  const grupos = useMemo(() => {
    const ordem: ResultadoBusca["tipo"][] = [
      "paciente",
      "pagina",
      "agendamento",
    ];
    const mapa = new Map<ResultadoBusca["tipo"], ResultadoBusca[]>();
    for (const r of resultados) {
      const lista = mapa.get(r.tipo) ?? [];
      lista.push(r);
      mapa.set(r.tipo, lista);
    }
    return ordem
      .filter((t) => mapa.has(t))
      .map((t) => ({ tipo: t, itens: mapa.get(t)! }));
  }, [resultados]);

  const irPara = useCallback(
    (resultado: ResultadoBusca) => {
      onOpenChange(false);
      router.push(resultado.url);
    },
    [onOpenChange, router],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (resultados.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSelecionado((idx) => Math.min(resultados.length - 1, idx + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSelecionado((idx) => Math.max(0, idx - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = resultados[indiceSelecionado] ?? resultados[0];
      if (item) irPara(item);
    }
  };

  // Foca o input ao abrir.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col overflow-hidden",
            "inset-x-4 top-[10vh] rounded-xl max-h-[80vh]",
            "sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[500px] sm:max-w-[calc(100vw-32px)]",
          )}
        >
          <Dialog.Title className="sr-only">Busca rapida</Dialog.Title>

          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 shrink-0">
            <Search
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-slate-500 shrink-0"
            />
            <input
              ref={inputRef}
              type="text"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar pacientes, paginas..."
              className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-[#94A3B8] focus:outline-none"
            />
            {carregando ? (
              <Loader2
                size={14}
                strokeWidth={1.5}
                className="animate-spin text-slate-500"
                aria-hidden="true"
              />
            ) : null}
            <Dialog.Close
              aria-label="Fechar"
              className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={16} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto">
            {termo.trim().length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-slate-500">
                Digite para buscar pacientes, paginas e agendamentos de hoje.
              </p>
            ) : !carregando && resultados.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-slate-500">
                Nada encontrado para &quot;{termo}&quot;.
              </p>
            ) : (
              <div className="py-1">
                {grupos.map((grupo, gi) => {
                  const indiceInicio = grupos
                    .slice(0, gi)
                    .reduce((acc, g) => acc + g.itens.length, 0);
                  return (
                    <div key={grupo.tipo} className="py-1">
                      <p className="px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        {LABEL_GRUPO[grupo.tipo]}
                      </p>
                      <ul>
                        {grupo.itens.map((item, ii) => {
                          const idx = indiceInicio + ii;
                          const ativo = idx === indiceSelecionado;
                          const Icon = ICONES[item.icone] ?? Search;
                          return (
                            <li key={`${item.tipo}-${item.id}`}>
                              <button
                                type="button"
                                onMouseEnter={() => setIndiceSelecionado(idx)}
                                onClick={() => irPara(item)}
                                className={cn(
                                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                  ativo
                                    ? "bg-primary-surface"
                                    : "hover:bg-slate-50",
                                )}
                              >
                                <Icon
                                  size={16}
                                  strokeWidth={1.5}
                                  aria-hidden="true"
                                  className={cn(
                                    "shrink-0",
                                    ativo
                                      ? "text-primary-text"
                                      : "text-slate-500",
                                  )}
                                />
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "block text-[14px] font-medium truncate",
                                      ativo
                                        ? "text-slate-900"
                                        : "text-slate-900",
                                    )}
                                  >
                                    {item.titulo}
                                  </span>
                                  {item.subtitulo ? (
                                    <span className="block text-[12px] text-slate-500 truncate">
                                      {item.subtitulo}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 shrink-0">
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>{" "}
              navegar
            </span>
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>{" "}
              abrir
            </span>
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
                Esc
              </kbd>{" "}
              fechar
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default CommandPalette;
