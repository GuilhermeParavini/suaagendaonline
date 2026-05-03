"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  salvarHorarios,
  type HorarioBloco,
} from "@/actions/configuracoes";
import { cn } from "@/lib/utils";

const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terca-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sabado",
];

interface TabHorariosProps {
  horarios: HorarioBloco[];
  onSaved: () => void;
}

type EstadoDia = {
  ativo: boolean;
  blocos: { hora_inicio: string; hora_fim: string }[];
};

function inicializar(horarios: HorarioBloco[]): EstadoDia[] {
  const por: EstadoDia[] = Array.from({ length: 7 }, () => ({
    ativo: false,
    blocos: [],
  }));
  for (const h of horarios) {
    if (h.dia_semana < 0 || h.dia_semana > 6) continue;
    por[h.dia_semana].ativo = true;
    por[h.dia_semana].blocos.push({
      hora_inicio: h.hora_inicio,
      hora_fim: h.hora_fim,
    });
  }
  return por;
}

function TabHorarios({ horarios, onSaved }: TabHorariosProps) {
  const [estado, setEstado] = useState<EstadoDia[]>(() =>
    inicializar(horarios),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggleAtivo = (dia: number) => {
    setEstado((prev) =>
      prev.map((d, i) => {
        if (i !== dia) return d;
        const ativo = !d.ativo;
        return {
          ativo,
          blocos:
            ativo && d.blocos.length === 0
              ? [{ hora_inicio: "08:00", hora_fim: "12:00" }]
              : d.blocos,
        };
      }),
    );
  };

  const adicionarBloco = (dia: number) => {
    setEstado((prev) =>
      prev.map((d, i) => {
        if (i !== dia) return d;
        return {
          ativo: true,
          blocos: [
            ...d.blocos,
            { hora_inicio: "14:00", hora_fim: "18:00" },
          ],
        };
      }),
    );
  };

  const removerBloco = (dia: number, idx: number) => {
    setEstado((prev) =>
      prev.map((d, i) => {
        if (i !== dia) return d;
        const blocos = d.blocos.filter((_, j) => j !== idx);
        return { ativo: blocos.length > 0, blocos };
      }),
    );
  };

  const alterarHora = (
    dia: number,
    idx: number,
    campo: "hora_inicio" | "hora_fim",
    valor: string,
  ) => {
    setEstado((prev) =>
      prev.map((d, i) => {
        if (i !== dia) return d;
        return {
          ...d,
          blocos: d.blocos.map((b, j) =>
            j === idx ? { ...b, [campo]: valor } : b,
          ),
        };
      }),
    );
  };

  const handleSalvar = () => {
    setErro(null);
    const blocos: HorarioBloco[] = [];
    for (let dia = 0; dia < 7; dia++) {
      const d = estado[dia];
      if (!d.ativo) continue;
      for (const b of d.blocos) {
        if (!b.hora_inicio || !b.hora_fim) {
          setErro(`Preencha as horas em ${DIAS[dia]}.`);
          return;
        }
        if (b.hora_inicio >= b.hora_fim) {
          setErro(
            `Em ${DIAS[dia]}, a hora de fim deve ser maior que a de inicio.`,
          );
          return;
        }
        blocos.push({
          dia_semana: dia,
          hora_inicio: b.hora_inicio,
          hora_fim: b.hora_fim,
        });
      }
    }

    startTransition(async () => {
      const result = await salvarHorarios(blocos);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setOkMsg(true);
      window.setTimeout(() => setOkMsg(false), 2000);
      onSaved();
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Defina os dias e horarios em que voce atende. Pacientes verao apenas os
        dias ativos no agendamento online.
      </p>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          Horarios atualizados
        </p>
      ) : null}

      <div className="space-y-2">
        {estado.map((d, dia) => (
          <div
            key={dia}
            className={cn(
              "rounded-lg border bg-white p-3 sm:p-4 transition-colors",
              d.ativo ? "border-slate-200" : "border-slate-100 bg-slate-50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.ativo}
                  onChange={() => toggleAtivo(dia)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    d.ativo ? "text-slate-900" : "text-slate-400",
                  )}
                >
                  {DIAS[dia]}
                </span>
              </label>

              {d.ativo ? (
                <button
                  type="button"
                  onClick={() => adicionarBloco(dia)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
                >
                  <Plus size={13} strokeWidth={1.5} aria-hidden="true" />
                  Adicionar horario
                </button>
              ) : null}
            </div>

            {d.ativo && d.blocos.length > 0 ? (
              <div className="mt-3 space-y-2">
                {d.blocos.map((b, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="time"
                      value={b.hora_inicio}
                      onChange={(e) =>
                        alterarHora(dia, idx, "hora_inicio", e.target.value)
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">a</span>
                    <input
                      type="time"
                      value={b.hora_fim}
                      onChange={(e) =>
                        alterarHora(dia, idx, "hora_fim", e.target.value)
                      }
                      className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removerBloco(dia, idx)}
                      aria-label="Remover horario"
                      className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <X size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={isPending}
          className="rounded bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar horarios"}
        </button>
      </div>
    </div>
  );
}

export default TabHorarios;
