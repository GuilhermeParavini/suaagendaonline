"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import type { AnamneseImpressaoData } from "@/lib/anamnese-pdf";
import type { CampoTemplate } from "@/actions/anamnese";
import { signatureFontClass } from "@/lib/signature-fonts";
import { cn } from "@/lib/utils";

interface AnamneseImpressaoProps {
  data: AnamneseImpressaoData;
  /** Aciona window.print() automaticamente ao abrir */
  autoPrint?: boolean;
}

function CampoValor({
  campo,
  valor,
}: {
  campo: CampoTemplate;
  valor: unknown;
}) {
  const vazio =
    valor === null ||
    valor === undefined ||
    (typeof valor === "string" && valor.trim() === "") ||
    (Array.isArray(valor) && valor.length === 0);

  if (vazio) {
    return (
      <p className="text-sm italic text-slate-500">Não informado</p>
    );
  }

  switch (campo.tipo) {
    case "texto_livre":
      return (
        <p className="text-sm text-slate-900 whitespace-pre-wrap">
          {String(valor)}
        </p>
      );

    case "selecao_multipla": {
      const arr = Array.isArray(valor) ? (valor as unknown[]) : [];
      return (
        <p className="text-sm text-slate-900">
          {arr.map((o) => String(o)).join(", ")}
        </p>
      );
    }

    case "sim_nao":
      return (
        <p className="text-sm font-medium text-slate-900">
          {valor ? "Sim" : "Não"}
        </p>
      );

    case "escala_numerica": {
      const n = typeof valor === "number" ? valor : Number(valor);
      const min = typeof campo.min === "number" ? campo.min : 0;
      const max = typeof campo.max === "number" ? campo.max : 10;
      const range = Math.max(1, max - min);
      const blocosTotais = max - min;
      const preenchidos = Math.max(0, Math.min(blocosTotais, n - min));
      const ascii =
        "█".repeat(preenchidos) + "░".repeat(blocosTotais - preenchidos);
      const pct = Math.max(0, Math.min(100, ((n - min) / range) * 100));
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">
            {n}/{max}
          </span>
          <div className="hidden print:inline font-mono text-xs text-slate-700">
            {ascii}
          </div>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 print:hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    }

    case "data": {
      const s = String(valor);
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) {
        return (
          <p className="text-sm text-slate-900">{`${m[3]}/${m[2]}/${m[1]}`}</p>
        );
      }
      return <p className="text-sm text-slate-900">{s}</p>;
    }

    case "upload_foto":
      return (
        <p className="text-sm italic text-slate-600">[Foto anexada]</p>
      );

    default:
      return <p className="text-sm text-slate-900">{String(valor)}</p>;
  }
}

function AnamneseImpressao({ data, autoPrint }: AnamneseImpressaoProps) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => {
      window.print();
    }, 600);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  const camposOrdenados = data.campos.slice().sort((a, b) => a.ordem - b.ordem);

  const temAssinatura =
    (data.profissional.assinaturaTipo === "fonte" &&
      !!data.profissional.assinaturaFonte) ||
    (data.profissional.assinaturaTipo === "imagem" &&
      !!data.profissional.assinaturaUrl);

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 18mm;
        }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .anamnese-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }
        }
      `}</style>

      <div className="space-y-4">
        <div className="no-print mx-auto flex max-w-[760px] items-center justify-between gap-3 px-4">
          <h1 className="text-[20px] font-semibold text-slate-900">
            Anamnese - {data.paciente.nome}
          </h1>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
          >
            <Printer size={14} strokeWidth={1.5} aria-hidden="true" />
            Imprimir / Salvar PDF
          </button>
        </div>

        <article className="anamnese-page mx-auto max-w-[760px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10 text-slate-900">
          {/* Cabecalho */}
          <header className="border-b-2 border-primary pb-3 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="shrink-0">
                {data.profissional.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.profissional.logoUrl}
                    alt="Logo"
                    className="max-h-12 w-auto object-contain"
                  />
                ) : null}
              </div>
              <div className="flex-1 text-right">
                <p className="text-base font-semibold text-primary-dark">
                  {data.clinicaNome}
                </p>
                <p className="text-xs text-slate-600">
                  {data.profissional.especialidade}
                  {data.profissional.registroProfissional
                    ? ` · ${data.profissional.registroProfissional}`
                    : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {data.profissional.email}
                  {data.profissional.telefone &&
                  data.profissional.telefone !== "—"
                    ? ` · ${data.profissional.telefone}`
                    : ""}
                </p>
              </div>
            </div>
          </header>

          {/* Titulo */}
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">
              {data.templateNome}
            </h2>
            <p className="text-sm text-slate-500">
              Preenchida em {data.dataExtenso}
            </p>
          </div>

          {/* Paciente */}
          <section className="mb-5 rounded-lg bg-primary-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-primary-dark">
              Paciente
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  Nome
                </dt>
                <dd className="text-slate-900">{data.paciente.nome}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  CPF
                </dt>
                <dd className="text-slate-900">{data.paciente.cpfMascarado}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  Data de nascimento
                </dt>
                <dd className="text-slate-900">
                  {data.paciente.dataNascimentoBR}
                  {data.paciente.idade !== null
                    ? ` (${data.paciente.idade} anos)`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  Gênero
                </dt>
                <dd className="text-slate-900">{data.paciente.genero}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  Telefone
                </dt>
                <dd className="text-slate-900">{data.paciente.telefone}</dd>
              </div>
              {data.paciente.email ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                    E-mail
                  </dt>
                  <dd className="break-all text-slate-900">
                    {data.paciente.email}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* Conteudo */}
          <section className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Anamnese
            </p>
            <div className="space-y-4">
              {camposOrdenados.map((c) => (
                <div key={c.id} className="break-inside-avoid">
                  <p className="text-sm font-semibold text-slate-900">
                    {c.label}
                  </p>
                  <div className="mt-1">
                    <CampoValor campo={c} valor={data.dados[c.id]} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Rodape com assinatura */}
          <footer className="mt-12 text-center">
            {temAssinatura ? (
              <div className="mx-auto mb-1 flex h-16 w-72 items-end justify-center">
                {data.profissional.assinaturaTipo === "fonte" ? (
                  <p
                    className={cn(
                      "text-[26px] leading-none text-slate-700",
                      signatureFontClass(data.profissional.assinaturaFonte),
                    )}
                  >
                    {data.profissional.nome}
                  </p>
                ) : data.profissional.assinaturaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.profissional.assinaturaUrl}
                    alt={`Assinatura de ${data.profissional.nome}`}
                    className="max-h-[56px] object-contain"
                  />
                ) : null}
              </div>
            ) : null}
            <div className="mx-auto w-72 border-t border-slate-400 pt-2">
              <p className="text-sm font-medium text-slate-900">
                {data.profissional.nome}
              </p>
              <p className="text-xs text-slate-600">
                {data.profissional.especialidade}
                {data.profissional.registroProfissional
                  ? ` · ${data.profissional.registroProfissional}`
                  : ""}
              </p>
            </div>
            <p className="mt-6 text-[11px] text-slate-500">
              Documento gerado em {data.geradoEm} pelo sistema Sua Agenda Online
            </p>
          </footer>
        </article>
      </div>
    </>
  );
}

export default AnamneseImpressao;
