import { Check, X } from "lucide-react";

type Row = {
  feature: string;
  agenda4u: boolean | string;
  simples: boolean | string;
  smart: boolean | string;
  iclinic: boolean | string;
};

const ROWS: Row[] = [
  {
    feature: "Preço individual",
    agenda4u: "R$ 29,90",
    simples: "R$ 39,90",
    smart: "R$ 39,90",
    iclinic: "R$ 90+",
  },
  { feature: "Transcrição por IA", agenda4u: true, simples: false, smart: false, iclinic: false },
  { feature: "Assistente IA", agenda4u: true, simples: false, smart: false, iclinic: false },
  { feature: "Anamnese personalizável", agenda4u: true, simples: false, smart: true, iclinic: true },
  { feature: "Financeiro completo", agenda4u: true, simples: true, smart: true, iclinic: true },
  { feature: "Agenda online", agenda4u: true, simples: true, smart: true, iclinic: true },
  { feature: "Comissões", agenda4u: true, simples: false, smart: false, iclinic: true },
  { feature: "Estoque", agenda4u: true, simples: false, smart: false, iclinic: false },
  { feature: "Foco em saúde", agenda4u: true, simples: false, smart: true, iclinic: true },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm font-medium text-slate-900">{value}</span>;
  }
  return value ? (
    <Check
      size={16}
      className="mx-auto text-[#22C55E] sm:h-5 sm:w-5"
      strokeWidth={2}
      aria-label="Sim"
    />
  ) : (
    <X
      size={16}
      className="mx-auto text-rose-400 sm:h-5 sm:w-5"
      strokeWidth={2}
      aria-label="Não"
    />
  );
}

export default function Comparison() {
  return (
    <section className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[22px] font-semibold leading-tight text-slate-900 sm:text-[28px]">
            Compare e decida
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:mt-4 sm:text-base">
            Mais barato e com mais funcionalidades essenciais que os
            concorrentes diretos.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 sm:mt-12">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-3 text-xs font-semibold text-slate-700 sm:px-6 sm:py-4 sm:text-sm">
                  Funcionalidade
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-[#115E59] sm:px-6 sm:py-4 sm:text-sm">
                  Agenda4U
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700 sm:px-6 sm:py-4 sm:text-sm">
                  Simples Agenda
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700 sm:px-6 sm:py-4 sm:text-sm">
                  AgendaSmart
                </th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700 sm:px-6 sm:py-4 sm:text-sm">
                  iClinic
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, idx) => (
                <tr
                  key={row.feature}
                  className={
                    idx % 2 === 0
                      ? "border-t border-slate-100 bg-white"
                      : "border-t border-slate-100 bg-slate-50/40"
                  }
                >
                  <td className="px-3 py-2.5 text-xs text-slate-700 sm:px-6 sm:py-3.5 sm:text-sm">
                    {row.feature}
                  </td>
                  <td className="bg-[#F0FDFA]/60 px-2 py-2.5 text-center sm:px-6 sm:py-3.5">
                    <Cell value={row.agenda4u} />
                  </td>
                  <td className="px-2 py-2.5 text-center sm:px-6 sm:py-3.5">
                    <Cell value={row.simples} />
                  </td>
                  <td className="px-2 py-2.5 text-center sm:px-6 sm:py-3.5">
                    <Cell value={row.smart} />
                  </td>
                  <td className="px-2 py-2.5 text-center sm:px-6 sm:py-3.5">
                    <Cell value={row.iclinic} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500 sm:mt-6 sm:text-xs">
          Preços consultados em maio/2026. Sujeitos a alteração pelos
          respectivos fornecedores.
        </p>
      </div>
    </section>
  );
}
