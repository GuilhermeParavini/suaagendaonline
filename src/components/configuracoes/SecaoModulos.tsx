"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  getModulosAtivos,
  toggleModulo,
} from "@/actions/planos";
import {
  MODULOS_INFO,
  moduloDisponivelNoPlano,
  type ModuloId,
  type ModulosAtivos,
} from "@/lib/planos";
import { cn } from "@/lib/utils";

interface SecaoModulosProps {
  plano: string;
}

const ORDEM: ModuloId[] = [
  "estoque",
  "comissoes",
  "planos_tratamento",
  "aftercare",
];

function SecaoModulos({ plano }: SecaoModulosProps) {
  const [modulos, setModulos] = useState<ModulosAtivos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<ModuloId | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await getModulosAtivos();
      if (cancelado) return;
      if (r.ok) setModulos(r.data);
      else setErro(r.error);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  async function alternar(modulo: ModuloId, valor: boolean) {
    setSalvando(modulo);
    setErro(null);
    const r = await toggleModulo(modulo, valor);
    setSalvando(null);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setModulos(r.data);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">
          Modulos do sistema
        </h2>
        <p className="text-[13px] text-slate-500">
          Ative apenas os modulos que voce usa. Itens desligados ficam ocultos
          do menu.
        </p>
      </header>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {erro}
        </p>
      ) : null}

      <ul className="space-y-2">
        {ORDEM.map((mod) => {
          const info = MODULOS_INFO[mod];
          const disponivel = moduloDisponivelNoPlano(plano, mod);
          const ativo = Boolean(modulos?.[mod]);
          const desabilitado = !disponivel || salvando === mod;

          return (
            <li
              key={mod}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border p-4",
                disponivel
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50",
              )}
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium text-slate-900">
                    {info.nome}
                  </p>
                  {!disponivel ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-700">
                      <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
                      Disponivel no plano Clinica
                    </span>
                  ) : null}
                </div>
                <p className="text-[13px] text-slate-500">{info.descricao}</p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={ativo}
                aria-label={`${ativo ? "Desativar" : "Ativar"} ${info.nome}`}
                disabled={desabilitado}
                onClick={() => alternar(mod, !ativo)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors no-touch-min",
                  ativo ? "bg-primary" : "bg-slate-300",
                  desabilitado && "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                    ativo ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default SecaoModulos;
