"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileLock2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getConsentimentosPaciente } from "@/actions/consentimento";
import {
  mascaraIp,
  type ConsentimentoItem,
} from "@/lib/consentimento-shared";

const TIPO_LABEL: Record<string, string> = {
  lgpd_geral: "LGPD geral",
  lgpd_menor: "LGPD - menor de idade",
  lgpd_agendamento: "LGPD - agendamento online",
  lgpd_cadastro: "LGPD - cadastro publico",
  lgpd_pre_consulta: "LGPD - pre-consulta",
};

interface SecaoConsentimentosProps {
  pacienteId: string;
}

function SecaoConsentimentos({ pacienteId }: SecaoConsentimentosProps) {
  const [items, setItems] = useState<ConsentimentoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await getConsentimentosPaciente(pacienteId);
      if (cancelado) return;
      if (!r.ok) {
        setErro(r.error);
        setItems([]);
        return;
      }
      setItems(r.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [pacienteId]);

  if (items === null) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
        <div className="flex items-center gap-2">
          <FileLock2
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="text-slate-500"
          />
          <h3 className="text-sm font-semibold text-slate-900">
            Consentimentos
          </h3>
        </div>
        <p className="text-xs text-slate-500">Carregando...</p>
      </section>
    );
  }

  if (erro) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
        Falha ao carregar consentimentos: {erro}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileLock2
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-slate-500"
        />
        <h3 className="text-sm font-semibold text-slate-900">
          Consentimentos
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0"
          />
          <span>
            Consentimento LGPD nao registrado. Registre no proximo cadastro ou
            agendamento.
          </span>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((c) => {
            const data = (() => {
              try {
                return format(new Date(c.created_at), "dd/MM/yyyy 'as' HH:mm", {
                  locale: ptBR,
                });
              } catch {
                return c.created_at;
              }
            })();
            const tipoLbl = TIPO_LABEL[c.tipo] ?? c.tipo;
            const ip = mascaraIp(c.ip);
            return (
              <li key={c.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-[13px] font-medium text-slate-900">
                    {tipoLbl}
                  </p>
                  <p className="text-[11px] text-slate-500">{data}</p>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {c.versao ? `Versao ${c.versao}` : "Versao —"}
                  {ip ? ` · IP ${ip}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default SecaoConsentimentos;
