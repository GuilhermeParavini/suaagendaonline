"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AssinaturaRecibo from "@/components/financeiro/AssinaturaRecibo";
import DocumentoHeader from "./DocumentoHeader";
import DocumentoAcoes from "./DocumentoAcoes";
import type { EvolucaoDocumentoData } from "@/actions/documentos";

interface PlanoCuidadosPrintProps {
  data: EvolucaoDocumentoData;
}

function PlanoCuidadosPrint({ data }: PlanoCuidadosPrintProps) {
  const docRef = useRef<HTMLElement | null>(null);
  const { evolucao, paciente, profissional, tenant } = data;

  const dataReferenciaIso = data.agendamento?.data_hora ?? evolucao.created_at;
  const dataReferencia = format(new Date(dataReferenciaIso), "dd/MM/yyyy", {
    locale: ptBR,
  });
  const dataEmissao = format(new Date(), "dd/MM/yyyy 'as' HH:mm", {
    locale: ptBR,
  });
  const cidade = [tenant.cidade, tenant.estado].filter(Boolean).join(" - ");

  const mensagem = [
    `Ola${paciente.nome ? `, ${paciente.nome.split(" ")[0]}` : ""}!`,
    "",
    `Segue seu plano de cuidados em casa orientado por ${profissional.nome}.`,
  ].join("\n");

  return (
    <>
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .documento-page {
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
            Plano de cuidados
          </h1>
        </div>

        <article
          ref={docRef}
          className="documento-page mx-auto max-w-[680px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10 text-slate-900"
        >
          <DocumentoHeader
            titulo="Plano de Cuidados Domiciliares"
            tenantNome={tenant.nome_empresa}
            endereco={tenant.endereco}
            cidade={cidade || null}
            logoUrl={profissional.logo_url}
          />

          <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Paciente
              </p>
              <p className="text-slate-900 font-medium break-words">
                {paciente.nome}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Data
              </p>
              <p className="text-slate-900 font-medium">{dataReferencia}</p>
            </div>
          </section>

          <hr className="mt-6 border-slate-200" />

          <section className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-primary-dark">
              Instrucoes para casa
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {evolucao.plano_cuidados ?? ""}
            </p>
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

          <p className="mt-6 text-center text-[11px] text-slate-400">
            Emitido em {dataEmissao}
          </p>
        </article>

        <DocumentoAcoes
          documentoRef={docRef}
          prefixoArquivo="plano-cuidados"
          pacienteNome={paciente.nome}
          pacienteEmail={paciente.email}
          dataReferencia={dataReferencia}
          assuntoEmail={`Plano de cuidados - ${profissional.nome} - ${dataReferencia}`}
          mensagemBase={mensagem}
          tituloShare="Plano de cuidados"
        />
      </div>
    </>
  );
}

export default PlanoCuidadosPrint;
