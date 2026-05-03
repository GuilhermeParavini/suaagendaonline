"use client";

import { useState } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Avatar from "@/components/ui/Avatar";
import StatusPill, { type StatusVariant } from "@/components/ui/StatusPill";
import { formatPhone, formatCPF, formatCEP } from "@/lib/masks";
import { calculateAge } from "@/lib/validators";
import { cn } from "@/lib/utils";
import EditarPacienteModal from "./EditarPacienteModal";
import ExcluirPacienteDialog from "./ExcluirPacienteDialog";

export type PacienteDetalhe = {
  id: string;
  nome: string;
  cpf: string;
  data_nascimento: string;
  genero: "masculino" | "feminino" | "prefiro_nao_informar";
  telefone: string;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  convenio: string | null;
  observacoes: string | null;
  menor_idade: boolean;
};

export type ResponsavelDetalhe = {
  nome: string;
  cpf: string;
  telefone: string;
  email: string | null;
  grau_parentesco: "mae" | "pai" | "avo" | "tio" | "outro";
};

export type AgendamentoHistorico = {
  id: string;
  data_hora: string;
  status: StatusVariant | "cancelado";
  procedimento_nome: string | null;
  profissional_nome: string | null;
};

interface FichaPacienteProps {
  paciente: PacienteDetalhe;
  responsavel: ResponsavelDetalhe | null;
  historico: AgendamentoHistorico[];
}

const generoLabel: Record<PacienteDetalhe["genero"], string> = {
  masculino: "Masculino",
  feminino: "Feminino",
  prefiro_nao_informar: "Prefiro não informar",
};

const parentescoLabel: Record<ResponsavelDetalhe["grau_parentesco"], string> = {
  mae: "Mãe",
  pai: "Pai",
  avo: "Avô(ó)",
  tio: "Tio(a)",
  outro: "Outro",
};

const isStatusVariant = (s: string): s is StatusVariant =>
  s === "agendado" ||
  s === "confirmado" ||
  s === "em_atendimento" ||
  s === "concluido" ||
  s === "faltou" ||
  s === "cancelado";

function DadoLinha({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm text-slate-900 break-words">{value}</p>
    </div>
  );
}

function FichaPaciente({ paciente, responsavel, historico }: FichaPacienteProps) {
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const idade = calculateAge(paciente.data_nascimento);
  const concluidos = historico.filter((h) => h.status === "concluido");
  const isRetorno = concluidos.length > 0;
  const ultimaConsulta = concluidos[0]?.data_hora ?? null;

  const enderecoCompleto = [
    paciente.endereco,
    [paciente.cidade, paciente.estado].filter(Boolean).join(" - ") || null,
    paciente.cep ? formatCEP(paciente.cep) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5 pb-12">
      <header className="flex items-center gap-3">
        <Link
          href="/pacientes"
          aria-label="Voltar para pacientes"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Paciente
        </h1>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-4">
          <Avatar
            name={paciente.nome}
            className="h-12 w-12 text-base shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-base font-semibold text-slate-900 leading-tight break-words">
                {paciente.nome}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                {idade !== null ? `${idade} ${idade === 1 ? "ano" : "anos"}` : "Idade indisponível"}
                {", "}
                {generoLabel[paciente.genero]}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-medium leading-none",
                  isRetorno
                    ? "bg-primary-surface text-primary-dark"
                    : "bg-info-surface text-[#1E40AF]",
                )}
              >
                {isRetorno ? "Retorno" : "Novo"}
              </span>
              {paciente.menor_idade ? (
                <span className="inline-flex items-center rounded-full bg-warning-surface px-2.5 py-[3px] text-[11px] font-medium leading-none text-[#92400E]">
                  Menor
                </span>
              ) : null}
              {ultimaConsulta ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-[3px] text-[11px] font-medium leading-none text-slate-600">
                  Última consulta:{" "}
                  {format(new Date(ultimaConsulta), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Tabs.Root defaultValue="dados">
        <Tabs.List
          aria-label="Abas do paciente"
          className="flex gap-1 border-b border-slate-200"
        >
          <Tabs.Trigger
            value="dados"
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors",
              "data-[state=active]:text-primary-dark",
              "after:absolute after:left-0 after:right-0 after:bottom-[-1px] after:h-[2px] after:bg-transparent",
              "data-[state=active]:after:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-t",
            )}
          >
            Dados
          </Tabs.Trigger>
          <Tabs.Trigger
            value="historico"
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors",
              "data-[state=active]:text-primary-dark",
              "after:absolute after:left-0 after:right-0 after:bottom-[-1px] after:h-[2px] after:bg-transparent",
              "data-[state=active]:after:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-t",
            )}
          >
            Histórico
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="dados" className="pt-4 focus-visible:outline-none">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[13px] font-medium text-slate-500">
                  Dados pessoais
                </h2>
                <button
                  type="button"
                  onClick={() => setModalEdicaoAberto(true)}
                  aria-label="Editar paciente"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
                >
                  <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
                  Editar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DadoLinha label="CPF" value={formatCPF(paciente.cpf)} />
                <DadoLinha
                  label="Telefone"
                  value={formatPhone(paciente.telefone)}
                />
                <DadoLinha label="E-mail" value={paciente.email} />
                <DadoLinha label="Convênio" value={paciente.convenio} />
              </div>
              {enderecoCompleto ? (
                <DadoLinha label="Endereço" value={enderecoCompleto} />
              ) : null}
              {paciente.observacoes ? (
                <DadoLinha label="Observações" value={paciente.observacoes} />
              ) : null}
            </div>

            {responsavel ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                <h2 className="text-[13px] font-medium text-amber-800">
                  Responsável legal
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DadoLinha label="Nome" value={responsavel.nome} />
                  <DadoLinha
                    label="Parentesco"
                    value={parentescoLabel[responsavel.grau_parentesco]}
                  />
                  <DadoLinha label="CPF" value={formatCPF(responsavel.cpf)} />
                  <DadoLinha
                    label="Telefone"
                    value={formatPhone(responsavel.telefone)}
                  />
                  <DadoLinha label="E-mail" value={responsavel.email} />
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalExclusaoAberto(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger bg-transparent px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-surface transition-colors"
              >
                <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                Excluir paciente
              </button>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="historico" className="pt-4 focus-visible:outline-none">
          {historico.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
              <p className="text-sm text-slate-500">
                Nenhum histórico de consultas.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {historico.map((ag) => {
                const status: StatusVariant = isStatusVariant(ag.status)
                  ? ag.status
                  : "agendado";
                const dt = new Date(ag.data_hora);
                const dataLabel = format(dt, "dd MMM yyyy", { locale: ptBR });
                const horaLabel = format(dt, "HH:mm", { locale: ptBR });

                return (
                  <li
                    key={ag.id}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-medium text-slate-900">
                          {dataLabel}
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 ml-1">{horaLabel}</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {ag.procedimento_nome ?? "Procedimento"}
                          {ag.profissional_nome ? (
                            <>
                              <span className="mx-1 text-slate-400">·</span>
                              {ag.profissional_nome}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <StatusPill status={status} className="shrink-0" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tabs.Content>
      </Tabs.Root>

      <EditarPacienteModal
        paciente={paciente}
        responsavel={responsavel}
        open={modalEdicaoAberto}
        onOpenChange={setModalEdicaoAberto}
      />

      <ExcluirPacienteDialog
        pacienteId={paciente.id}
        pacienteNome={paciente.nome}
        open={modalExclusaoAberto}
        onOpenChange={setModalExclusaoAberto}
      />
    </div>
  );
}

export default FichaPaciente;
