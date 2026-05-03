"use client";

import { Printer } from "lucide-react";

interface ReciboPrintProps {
  tenant: {
    nome_empresa: string;
    endereco: string | null;
    cidade: string;
  };
  profissional: {
    nome: string;
    especialidade: string;
    registro_profissional: string | null;
    email: string;
    telefone: string | null;
  };
  paciente: { id: string; nome: string } | null;
  descricao: string;
  valorFormatado: string;
  valorExtenso: string;
  dataPagamento: string;
  formaPagamento: string | null;
}

function ReciboPrint({
  tenant,
  profissional,
  paciente,
  descricao,
  valorFormatado,
  valorExtenso,
  dataPagamento,
  formaPagamento,
}: ReciboPrintProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .recibo-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 24px !important;
            max-width: none !important;
          }
          aside, nav, header[data-app-header], .fixed { display: none !important; }
        }
      `}</style>

      <div className="space-y-4">
        <div className="no-print flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
            Recibo
          </h1>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
          >
            <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
            Imprimir
          </button>
        </div>

        <article className="recibo-page mx-auto max-w-[680px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10 text-slate-900">
          <header className="text-center border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold uppercase tracking-wide">
              Recibo de Pagamento
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {tenant.nome_empresa}
            </p>
            {tenant.endereco ? (
              <p className="text-xs text-slate-500">{tenant.endereco}</p>
            ) : null}
            {tenant.cidade ? (
              <p className="text-xs text-slate-500">{tenant.cidade}</p>
            ) : null}
          </header>

          <section className="mt-6 space-y-3 text-sm leading-relaxed">
            <p>
              Recebi de{" "}
              <span className="font-semibold">
                {paciente?.nome ?? "(nao informado)"}
              </span>{" "}
              a importancia de{" "}
              <span className="font-semibold">{valorFormatado}</span> (
              <span className="italic">{valorExtenso}</span>) referente a{" "}
              <span className="font-medium">{descricao}</span>
              {formaPagamento ? (
                <>
                  , pago atraves de{" "}
                  <span className="font-medium">{formaPagamento}</span>
                </>
              ) : null}
              .
            </p>
            <p>
              Para clareza firmo o presente recibo, dando plena, geral e
              irrevogavel quitacao do valor recebido.
            </p>
          </section>

          <section className="mt-8 grid grid-cols-2 gap-6 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-500">Data</p>
              <p className="mt-1 text-slate-900">{dataPagamento}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Valor</p>
              <p className="mt-1 text-slate-900">{valorFormatado}</p>
            </div>
          </section>

          <section className="mt-12 text-center text-sm">
            <div className="mx-auto w-72 border-t border-slate-400 pt-2">
              <p className="font-medium">{profissional.nome}</p>
              <p className="text-xs text-slate-600">
                {profissional.especialidade}
                {profissional.registro_profissional
                  ? ` - ${profissional.registro_profissional}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {profissional.email}
                {profissional.telefone ? ` - ${profissional.telefone}` : ""}
              </p>
            </div>
          </section>
        </article>
      </div>
    </>
  );
}

export default ReciboPrint;
