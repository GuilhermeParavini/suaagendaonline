"use client";

import { useState } from "react";
import { Mail, MessageCircle, Printer } from "lucide-react";
import AssinaturaRecibo from "./AssinaturaRecibo";

interface ReciboPrintProps {
  id: string;
  pacienteEmail: string | null;
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
    assinatura_tipo: "fonte" | "imagem" | null;
    assinatura_fonte: string | null;
    assinatura_url: string | null;
  };
  paciente: { id: string; nome: string } | null;
  descricao: string;
  valorFormatado: string;
  valorExtenso: string;
  dataPagamento: string;
  formaPagamento: string | null;
}

function montarMensagem(params: {
  profissionalNome: string;
  valor: string;
  data: string;
  descricao: string;
  url: string;
}) {
  return [
    "Ola! Segue seu recibo de pagamento:",
    "",
    `Profissional: ${params.profissionalNome}`,
    `Valor: ${params.valor}`,
    `Data: ${params.data}`,
    `Referente a: ${params.descricao}`,
    "",
    `Acesse o recibo completo: ${params.url}`,
  ].join("\n");
}

function ReciboPrint({
  id,
  pacienteEmail,
  tenant,
  profissional,
  paciente,
  descricao,
  valorFormatado,
  valorExtenso,
  dataPagamento,
  formaPagamento,
}: ReciboPrintProps) {
  const [copiado, setCopiado] = useState(false);

  const buildUrlPublica = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/recibo/${id}`;
  };

  const buildMensagem = () => {
    return montarMensagem({
      profissionalNome: profissional.nome,
      valor: valorFormatado,
      data: dataPagamento,
      descricao,
      url: buildUrlPublica(),
    });
  };

  const handleWhatsApp = () => {
    const texto = encodeURIComponent(buildMensagem());
    window.open(`https://wa.me/?text=${texto}`, "_blank", "noopener,noreferrer");
  };

  const handleEmail = () => {
    // TODO: trocar para envio via Resend quando implementado
    const assunto = encodeURIComponent(
      `Recibo - ${profissional.nome} - ${dataPagamento}`,
    );
    const corpo = encodeURIComponent(buildMensagem());
    const destino = pacienteEmail ?? "";
    window.location.href = `mailto:${destino}?subject=${assunto}&body=${corpo}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopiarLink = async () => {
    const url = buildUrlPublica();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // ignora
    }
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
                {paciente?.nome ?? "(não informado)"}
              </span>{" "}
              a importância de{" "}
              <span className="font-semibold">{valorFormatado}</span> (
              <span className="italic">{valorExtenso}</span>) referente a{" "}
              <span className="font-medium">{descricao}</span>
              {formaPagamento ? (
                <>
                  , pago através de{" "}
                  <span className="font-medium">{formaPagamento}</span>
                </>
              ) : null}
              .
            </p>
            <p>
              Para clareza firmo o presente recibo, dando plena, geral e
              irrevogável quitação do valor recebido.
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

          <AssinaturaRecibo
            nome={profissional.nome}
            especialidade={profissional.especialidade}
            registroProfissional={profissional.registro_profissional}
            email={profissional.email}
            telefone={profissional.telefone}
            assinaturaTipo={profissional.assinatura_tipo}
            assinaturaFonte={profissional.assinatura_fonte}
            assinaturaUrl={profissional.assinatura_url}
          />
        </article>

        <div className="no-print mx-auto max-w-[680px] space-y-2 pt-2">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-sm font-medium text-white hover:bg-[#1ebe5a] transition-colors active:scale-[0.99]"
          >
            <MessageCircle size={16} strokeWidth={1.5} aria-hidden="true" />
            Enviar por WhatsApp
          </button>

          <button
            type="button"
            onClick={handleEmail}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-5 py-3 text-sm font-medium text-primary hover:bg-primary-surface transition-colors active:scale-[0.99]"
          >
            <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
            Enviar por e-mail
          </button>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopiarLink}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              {copiado ? "Link copiado" : "Copiar link"}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <Printer size={13} strokeWidth={1.5} aria-hidden="true" />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ReciboPrint;
