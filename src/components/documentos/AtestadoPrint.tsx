"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AssinaturaRecibo from "@/components/financeiro/AssinaturaRecibo";
import DocumentoHeader from "./DocumentoHeader";
import DocumentoAcoes from "./DocumentoAcoes";
import { dataPorExtensoSimples } from "@/lib/documento-imagem";
import type { AtestadoData } from "@/actions/documentos";

interface AtestadoPrintProps {
  data: AtestadoData;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function calcularHorarioFim(
  dataHoraIso: string,
  duracaoMin: number,
): string {
  const inicio = new Date(dataHoraIso);
  const fim = new Date(inicio.getTime() + duracaoMin * 60_000);
  return `${pad2(fim.getUTCHours())}:${pad2(fim.getUTCMinutes())}`;
}

function AtestadoPrint({ data }: AtestadoPrintProps) {
  const docRef = useRef<HTMLElement | null>(null);
  const { agendamento, paciente, procedimento, profissional, tenant } = data;

  const dataHora = new Date(agendamento.data_hora);
  const dataIso = agendamento.data_hora.slice(0, 10);
  const dataExtenso = dataPorExtensoSimples(dataIso);
  const dataAgendamento = format(dataHora, "dd/MM/yyyy", { locale: ptBR });
  const horaInicio = format(dataHora, "HH:mm", {
    locale: ptBR,
    timeZone: "UTC",
  } as Parameters<typeof format>[2]);
  const horaFim = calcularHorarioFim(
    agendamento.data_hora,
    agendamento.duracao_min || (procedimento?.duracao_min ?? 60),
  );

  const dataEmissao = format(new Date(), "dd/MM/yyyy 'as' HH:mm", {
    locale: ptBR,
  });
  const cidade = [tenant.cidade, tenant.estado].filter(Boolean).join(" - ");
  const cidadeEmitido = tenant.cidade
    ? `${tenant.cidade}${tenant.estado ? ` - ${tenant.estado}` : ""}`
    : "";

  const procedimentoNome = procedimento?.nome ?? "atendimento clinico";

  const mensagem = [
    `Ola${paciente.nome ? `, ${paciente.nome.split(" ")[0]}` : ""}!`,
    "",
    `Segue seu atestado de comparecimento referente a consulta em ${dataAgendamento}.`,
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
            Atestado de comparecimento
          </h1>
        </div>

        <article
          ref={docRef}
          className="documento-page mx-auto max-w-[680px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10 text-slate-900"
        >
          <DocumentoHeader
            titulo="Atestado de Comparecimento"
            tenantNome={tenant.nome_empresa}
            endereco={tenant.endereco}
            cidade={cidade || null}
            logoUrl={profissional.logo_url}
          />

          <section className="mt-8 space-y-4 text-sm leading-relaxed">
            <p className="text-justify">
              Atesto para os devidos fins que{" "}
              <span className="font-semibold">{paciente.nome}</span>, portador(a)
              do documento de identificacao, compareceu a esta clinica no dia{" "}
              <span className="font-semibold">{dataExtenso}</span> no horario
              das <span className="font-semibold">{horaInicio}</span> as{" "}
              <span className="font-semibold">{horaFim}</span>, para realizacao
              de <span className="font-semibold">{procedimentoNome}</span>.
            </p>
          </section>

          <section className="mt-10 text-right text-sm text-slate-600">
            <p>
              {cidadeEmitido ? `${cidadeEmitido}, ` : ""}
              {dataExtenso}.
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

          <p className="mt-6 text-center text-[11px] text-slate-500">
            Emitido em {dataEmissao}
          </p>
        </article>

        <DocumentoAcoes
          documentoRef={docRef}
          prefixoArquivo="atestado"
          pacienteNome={paciente.nome}
          pacienteEmail={paciente.email}
          dataReferencia={dataAgendamento}
          assuntoEmail={`Atestado de comparecimento - ${profissional.nome} - ${dataAgendamento}`}
          mensagemBase={mensagem}
          tituloShare="Atestado de comparecimento"
        />
      </div>
    </>
  );
}

export default AtestadoPrint;
