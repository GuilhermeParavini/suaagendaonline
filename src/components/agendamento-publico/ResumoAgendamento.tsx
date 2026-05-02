"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ResumoAgendamentoProps {
  profissionalNome: string;
  procedimentoNome: string;
  data: Date;
  hora: string;
  pacienteNome: string;
  valor?: number | null;
}

const currencyBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ResumoAgendamento({
  profissionalNome,
  procedimentoNome,
  data,
  hora,
  pacienteNome,
  valor,
}: ResumoAgendamentoProps) {
  const dataExtenso = format(data, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dataCapital =
    dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  return (
    <dl className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-200">
      <Item label="Profissional" value={profissionalNome} />
      <Item label="Procedimento" value={procedimentoNome} />
      <Item label="Data" value={dataCapital} />
      <Item label="Horário" value={hora} />
      <Item label="Paciente" value={pacienteNome} />
      {valor !== null && valor !== undefined ? (
        <Item label="Valor" value={currencyBRL(valor)} />
      ) : null}
    </dl>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-[13px] text-slate-500 shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 text-right break-words">
        {value}
      </dd>
    </div>
  );
}

export default ResumoAgendamento;
