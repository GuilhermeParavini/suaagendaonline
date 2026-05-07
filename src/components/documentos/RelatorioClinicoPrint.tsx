"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AssinaturaRecibo from "@/components/financeiro/AssinaturaRecibo";
import DocumentoHeader from "./DocumentoHeader";
import DocumentoAcoes from "./DocumentoAcoes";
import { calculateAge } from "@/lib/validators";
import { formatPhone } from "@/lib/masks";
import type { EvolucaoDocumentoData } from "@/actions/documentos";

const GENERO_LABEL: Record<
  EvolucaoDocumentoData["paciente"]["genero"],
  string
> = {
  masculino: "Masculino",
  feminino: "Feminino",
  prefiro_nao_informar: "Prefere nao informar",
};

interface RelatorioClinicoPrintProps {
  data: EvolucaoDocumentoData;
}

function Secao({
  titulo,
  texto,
}: {
  titulo: string;
  texto: string | null;
}) {
  if (!texto || !texto.trim()) return null;
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold text-primary-dark">{titulo}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {texto}
      </p>
    </section>
  );
}

function RelatorioClinicoPrint({ data }: RelatorioClinicoPrintProps) {
  const docRef = useRef<HTMLElement | null>(null);

  const { evolucao, agendamento, paciente, procedimento, profissional, tenant } =
    data;

  const dataAtendimentoIso = agendamento?.data_hora ?? evolucao.created_at;
  const dataAtendimento = format(new Date(dataAtendimentoIso), "dd/MM/yyyy", {
    locale: ptBR,
  });
  const horaAtendimento = format(new Date(dataAtendimentoIso), "HH:mm", {
    locale: ptBR,
    timeZone: "UTC",
  } as Parameters<typeof format>[2]);
  const dataEmissao = format(new Date(), "dd/MM/yyyy 'as' HH:mm", {
    locale: ptBR,
  });

  const idade = paciente.data_nascimento
    ? calculateAge(paciente.data_nascimento)
    : null;
  const cidade = [tenant.cidade, tenant.estado].filter(Boolean).join(" - ");

  const mensagem = [
    `Ola${paciente.nome ? `, ${paciente.nome.split(" ")[0]}` : ""}!`,
    "",
    `Segue seu relatorio clinico do atendimento em ${dataAtendimento} com ${profissional.nome}.`,
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
            Relatorio clinico
          </h1>
        </div>

        <article
          ref={docRef}
          className="documento-page mx-auto max-w-[680px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10 text-slate-900"
        >
          <DocumentoHeader
            titulo="Relatorio Clinico"
            tenantNome={tenant.nome_empresa}
            endereco={tenant.endereco}
            cidade={cidade || null}
            logoUrl={profissional.logo_url}
          />

          <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Paciente
              </p>
              <p className="text-slate-900 font-medium break-words">
                {paciente.nome}
              </p>
              <p className="text-xs text-slate-500">
                {idade !== null
                  ? `${idade} ${idade === 1 ? "ano" : "anos"} · `
                  : ""}
                {GENERO_LABEL[paciente.genero]}
              </p>
              {paciente.telefone || paciente.email ? (
                <p className="mt-0.5 text-xs text-slate-500">
                  {paciente.telefone ? formatPhone(paciente.telefone) : ""}
                  {paciente.telefone && paciente.email ? " · " : ""}
                  {paciente.email ?? ""}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Atendimento
              </p>
              <p className="text-slate-900 font-medium">
                {dataAtendimento}
                {agendamento ? ` as ${horaAtendimento}` : ""}
              </p>
              {procedimento ? (
                <p className="text-xs text-slate-500">
                  {procedimento.nome} · {procedimento.duracao_min} min
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-slate-500">
                {profissional.nome}
                {profissional.registro_profissional
                  ? ` · ${profissional.registro_profissional}`
                  : ""}
              </p>
            </div>
          </section>

          <hr className="mt-6 border-slate-200" />

          <div className="mt-6 space-y-5">
            <Secao titulo="Evolucao Clinica" texto={evolucao.texto} />
            <Secao titulo="Diagnostico" texto={evolucao.diagnostico} />
            <Secao titulo="Receita" texto={evolucao.receita} />
            <Secao
              titulo="Plano de cuidados em casa"
              texto={evolucao.plano_cuidados}
            />

            {!evolucao.texto &&
            !evolucao.diagnostico &&
            !evolucao.receita &&
            !evolucao.plano_cuidados ? (
              <p className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Sem registro clinico nesta evolucao.
              </p>
            ) : null}
          </div>

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
            Emitido em {dataEmissao} · Este documento e de uso exclusivo do
            paciente e profissional
          </p>
        </article>

        <DocumentoAcoes
          documentoRef={docRef}
          prefixoArquivo="relatorio-clinico"
          pacienteNome={paciente.nome}
          pacienteEmail={paciente.email}
          pacienteTelefone={paciente.telefone}
          dataReferencia={dataAtendimento}
          assuntoEmail={`Relatorio clinico - ${profissional.nome} - ${dataAtendimento}`}
          mensagemBase={mensagem}
          tituloShare="Relatorio clinico"
        />
      </div>
    </>
  );
}

export default RelatorioClinicoPrint;
