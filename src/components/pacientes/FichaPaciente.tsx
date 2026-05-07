"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Avatar from "@/components/ui/Avatar";
import StatusPill, { type StatusVariant } from "@/components/ui/StatusPill";
import { cleanPhone, formatPhone, formatCEP } from "@/lib/masks";
import { calculateAge } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { getAnamneses, type Anamnese } from "@/actions/anamnese";
import { getEvolucoes, type Evolucao } from "@/actions/evolucoes";
import EditarPacienteModal from "./EditarPacienteModal";
import ExcluirPacienteDialog from "./ExcluirPacienteDialog";
import TabAnamnesePaciente from "./TabAnamnesePaciente";
import TabDocumentos from "./TabDocumentos";
import TabPlanos from "./TabPlanos";
import AnamneseDetalhe from "./AnamneseDetalhe";
import EvolucaoDetalhe from "./EvolucaoDetalhe";
import AltaPacienteSection from "./AltaPacienteSection";
import { ORIGEM_LABEL } from "@/lib/paciente-origem";
import {
  CONTATO_INFO,
  PillContatoPreferencial,
  type ContatoCanal,
} from "./ContatoPreferencial";

function formatarAlturaMetros(altura_cm: number): string {
  const m = altura_cm / 100;
  return `${m.toFixed(2).replace(".", ",")} m`;
}

function formatarPeso(peso_kg: number): string {
  return `${peso_kg.toFixed(1).replace(".", ",")} kg`;
}

function calcularImc(altura_cm: number, peso_kg: number): number {
  const m = altura_cm / 100;
  if (m <= 0) return 0;
  return peso_kg / (m * m);
}

function classificacaoImc(imc: number): {
  label: string;
  cor: "verde" | "amber" | "vermelho";
} {
  if (imc < 18.5) return { label: "Abaixo do peso", cor: "amber" };
  if (imc < 25) return { label: "Normal", cor: "verde" };
  if (imc < 30) return { label: "Sobrepeso", cor: "amber" };
  if (imc < 35) return { label: "Obesidade I", cor: "vermelho" };
  if (imc < 40) return { label: "Obesidade II", cor: "vermelho" };
  return { label: "Obesidade III", cor: "vermelho" };
}

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
  altura: number | null;
  peso: number | null;
  origem: import("@/lib/paciente-origem").OrigemPaciente | null;
  origem_detalhe: string | null;
  status_tratamento: "ativo" | "alta" | "inativo";
  data_alta: string | null;
  motivo_alta: string | null;
  contato_preferencial: "whatsapp" | "telefone" | "email" | "sms";
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
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-sm text-slate-900 break-words">{value}</p>
    </div>
  );
}

function BotoesContato({ paciente }: { paciente: PacienteDetalhe }) {
  const tel = cleanPhone(paciente.telefone ?? "");
  const email = paciente.email ?? "";
  const preferido = paciente.contato_preferencial;

  type Botao = {
    canal: ContatoCanal;
    href: string | null;
    disponivel: boolean;
  };

  const botoes: Botao[] = [
    {
      canal: "whatsapp",
      href: tel ? `https://wa.me/55${tel}` : null,
      disponivel: Boolean(tel),
    },
    {
      canal: "telefone",
      href: tel ? `tel:+55${tel}` : null,
      disponivel: Boolean(tel),
    },
    {
      canal: "email",
      href: email ? `mailto:${email}` : null,
      disponivel: Boolean(email),
    },
    {
      canal: "sms",
      href: tel ? `sms:+55${tel}` : null,
      disponivel: Boolean(tel),
    },
  ];

  const algumDisponivel = botoes.some((b) => b.disponivel);
  if (!algumDisponivel) return null;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Contato rapido
      </p>
      <div className="flex flex-wrap gap-2">
        {botoes.map((b) => {
          const info = CONTATO_INFO[b.canal];
          const isPreferido = b.canal === preferido;
          if (!b.disponivel || !b.href) return null;
          return (
            <a
              key={b.canal}
              href={b.href}
              target={b.canal === "whatsapp" ? "_blank" : undefined}
              rel={b.canal === "whatsapp" ? "noopener noreferrer" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[14px] font-medium transition-colors",
                isPreferido
                  ? "border-primary bg-primary text-white hover:bg-primary-dark"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <info.Icon
                width={16}
                height={16}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              {info.labelCurto}
              {isPreferido ? (
                <span className="ml-1 inline-flex items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  Preferido
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function FichaPaciente({ paciente, responsavel, historico }: FichaPacienteProps) {
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [anamneses, setAnamneses] = useState<Anamnese[]>([]);
  const [evolucoes, setEvolucoes] = useState<Evolucao[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const recarregarAnamneses = useCallback(() => {
    startTransition(async () => {
      const r = await getAnamneses(paciente.id);
      if (r.ok) setAnamneses(r.data);
    });
  }, [paciente.id]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [rA, rE] = await Promise.all([
        getAnamneses(paciente.id),
        getEvolucoes(paciente.id),
      ]);
      if (cancelado) return;
      if (rA.ok) setAnamneses(rA.data);
      if (rE.ok) setEvolucoes(rE.data);
    })();
    return () => {
      cancelado = true;
    };
  }, [paciente.id]);

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const idade = calculateAge(paciente.data_nascimento);
  const concluidos = historico.filter((h) => h.status === "concluido");
  const isRetorno = concluidos.length > 0;
  const ultimaConsulta = concluidos[0]?.data_hora ?? null;

  type ItemHistorico =
    | { tipo: "agendamento"; data: string; agendamento: AgendamentoHistorico }
    | { tipo: "anamnese"; data: string; anamnese: Anamnese }
    | { tipo: "evolucao"; data: string; evolucao: Evolucao };

  const historicoMesclado: ItemHistorico[] = [
    ...historico.map((ag) => ({
      tipo: "agendamento" as const,
      data: ag.data_hora,
      agendamento: ag,
    })),
    ...anamneses.map((a) => ({
      tipo: "anamnese" as const,
      data: a.created_at,
      anamnese: a,
    })),
    ...evolucoes.map((ev) => ({
      tipo: "evolucao" as const,
      data: ev.created_at,
      evolucao: ev,
    })),
  ].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

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

      {paciente.status_tratamento !== "ativo" ? (
        <AltaPacienteSection
          pacienteId={paciente.id}
          pacienteNome={paciente.nome}
          status={paciente.status_tratamento}
          dataAlta={paciente.data_alta}
          motivoAlta={paciente.motivo_alta}
        />
      ) : null}

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
              {paciente.convenio ? (
                <span className="inline-flex items-center rounded-full bg-primary-surface px-2.5 py-[3px] text-[11px] font-medium leading-none text-primary-dark">
                  {paciente.convenio}
                </span>
              ) : null}
              {!paciente.email ? (
                <span
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-[3px] text-[11px] font-medium leading-none text-slate-500"
                  title="Paciente sem e-mail cadastrado"
                >
                  Sem e-mail
                </span>
              ) : null}
              <PillContatoPreferencial canal={paciente.contato_preferencial} />
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
            value="anamnese"
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors",
              "data-[state=active]:text-primary-dark",
              "after:absolute after:left-0 after:right-0 after:bottom-[-1px] after:h-[2px] after:bg-transparent",
              "data-[state=active]:after:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-t",
            )}
          >
            Anamnese
          </Tabs.Trigger>
          <Tabs.Trigger
            value="documentos"
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors",
              "data-[state=active]:text-primary-dark",
              "after:absolute after:left-0 after:right-0 after:bottom-[-1px] after:h-[2px] after:bg-transparent",
              "data-[state=active]:after:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-t",
            )}
          >
            Documentos
          </Tabs.Trigger>
          <Tabs.Trigger
            value="planos"
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors",
              "data-[state=active]:text-primary-dark",
              "after:absolute after:left-0 after:right-0 after:bottom-[-1px] after:h-[2px] after:bg-transparent",
              "data-[state=active]:after:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-t",
            )}
          >
            Planos
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors"
                >
                  <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
                  Editar
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Telefone
                    {!paciente.email ? (
                      <span className="ml-1 text-primary-dark">
                        (contato principal)
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={cn(
                      "break-words",
                      !paciente.email
                        ? "text-base font-semibold text-slate-900"
                        : "text-sm text-slate-900",
                    )}
                  >
                    {formatPhone(paciente.telefone)}
                  </p>
                </div>
                {paciente.email ? (
                  <DadoLinha label="E-mail" value={paciente.email} />
                ) : null}
                <DadoLinha label="Convênio" value={paciente.convenio} />
              </div>

              <BotoesContato paciente={paciente} />
              {paciente.altura !== null || paciente.peso !== null ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {paciente.altura !== null ? (
                    <DadoLinha
                      label="Altura"
                      value={formatarAlturaMetros(paciente.altura)}
                    />
                  ) : null}
                  {paciente.peso !== null ? (
                    <DadoLinha
                      label="Peso"
                      value={formatarPeso(paciente.peso)}
                    />
                  ) : null}
                  {paciente.altura !== null && paciente.peso !== null ? (
                    (() => {
                      const imc = calcularImc(paciente.altura, paciente.peso);
                      const cls = classificacaoImc(imc);
                      const corClass =
                        cls.cor === "verde"
                          ? "bg-[#D1FAE5] text-[#065F46]"
                          : cls.cor === "amber"
                            ? "bg-warning-surface text-[#92400E]"
                            : "bg-danger-surface text-danger";
                      return (
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            IMC
                          </p>
                          <p className="text-sm text-slate-900">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[12px] font-semibold leading-none",
                                corClass,
                              )}
                            >
                              {imc.toFixed(1).replace(".", ",")}
                              <span className="font-medium">— {cls.label}</span>
                            </span>
                          </p>
                        </div>
                      );
                    })()
                  ) : null}
                </div>
              ) : null}
              {paciente.origem ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Como nos conheceu
                  </p>
                  <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-[3px] text-[12px] font-medium leading-none text-teal-700">
                    {ORIGEM_LABEL[paciente.origem]}
                    {paciente.origem === "outros" && paciente.origem_detalhe
                      ? `: ${paciente.origem_detalhe}`
                      : ""}
                  </span>
                </div>
              ) : null}
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
                  <DadoLinha
                    label="Telefone"
                    value={formatPhone(responsavel.telefone)}
                  />
                  <DadoLinha label="E-mail" value={responsavel.email} />
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              {paciente.status_tratamento === "ativo" ? (
                <AltaPacienteSection
                  pacienteId={paciente.id}
                  pacienteNome={paciente.nome}
                  status={paciente.status_tratamento}
                  dataAlta={paciente.data_alta}
                  motivoAlta={paciente.motivo_alta}
                />
              ) : null}
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

        <Tabs.Content value="anamnese" className="pt-4 focus-visible:outline-none">
          <TabAnamnesePaciente
            pacienteId={paciente.id}
            onAnamneseCriada={recarregarAnamneses}
          />
        </Tabs.Content>

        <Tabs.Content value="documentos" className="pt-4 focus-visible:outline-none">
          <TabDocumentos pacienteId={paciente.id} />
        </Tabs.Content>

        <Tabs.Content value="planos" className="pt-4 focus-visible:outline-none">
          <TabPlanos pacienteId={paciente.id} />
        </Tabs.Content>

        <Tabs.Content value="historico" className="pt-4 focus-visible:outline-none">
          {historicoMesclado.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
              <p className="text-sm text-slate-500">
                Nenhum histórico para este paciente.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {historicoMesclado.map((item) => {
                if (item.tipo === "evolucao") {
                  const ev = item.evolucao;
                  const expandido = expandidos.has(`ev-${ev.id}`);
                  const dt = new Date(ev.created_at);
                  const dataLabel = format(dt, "dd MMM yyyy", { locale: ptBR });
                  const horaLabel = format(dt, "HH:mm", { locale: ptBR });
                  const corpo = (ev.texto ?? ev.transcricao ?? "").trim();
                  const resumo =
                    corpo.length > 100 ? `${corpo.slice(0, 100)}…` : corpo;
                  return (
                    <li
                      key={`ev-${ev.id}`}
                      className="rounded-lg border border-slate-200 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpandido(`ev-${ev.id}`)}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg"
                      >
                        <FileText
                          size={18}
                          strokeWidth={1.5}
                          className="shrink-0 text-primary-text"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm font-medium text-slate-900">
                            {dataLabel}
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-600 ml-1">
                              {horaLabel}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            Evolução
                            {resumo ? `: ${resumo}` : ""}
                          </p>
                        </div>
                        {expandido ? (
                          <ChevronUp
                            size={16}
                            strokeWidth={1.5}
                            className="text-slate-500 shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                            strokeWidth={1.5}
                            className="text-slate-500 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                      {expandido ? (
                        <div className="border-t border-slate-100 px-3 py-3">
                          <EvolucaoDetalhe evolucao={ev} />
                        </div>
                      ) : null}
                    </li>
                  );
                }

                if (item.tipo === "agendamento") {
                  const ag = item.agendamento;
                  const status: StatusVariant = isStatusVariant(ag.status)
                    ? ag.status
                    : "agendado";
                  const dt = new Date(ag.data_hora);
                  const dataLabel = format(dt, "dd MMM yyyy", { locale: ptBR });
                  const horaLabel = format(dt, "HH:mm", { locale: ptBR });

                  return (
                    <li
                      key={`ag-${ag.id}`}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm font-medium text-slate-900">
                            {dataLabel}
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-600 ml-1">
                              {horaLabel}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {ag.procedimento_nome ?? "Procedimento"}
                            {ag.profissional_nome ? (
                              <>
                                <span className="mx-1 text-slate-500">·</span>
                                {ag.profissional_nome}
                              </>
                            ) : null}
                          </p>
                        </div>
                        <StatusPill status={status} className="shrink-0" />
                      </div>
                    </li>
                  );
                }

                const a = item.anamnese;
                const expandido = expandidos.has(a.id);
                const dt = new Date(a.created_at);
                const dataLabel = format(dt, "dd MMM yyyy", { locale: ptBR });
                const horaLabel = format(dt, "HH:mm", { locale: ptBR });

                return (
                  <li
                    key={`an-${a.id}`}
                    className="rounded-lg border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpandido(a.id)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg"
                    >
                      <ClipboardList
                        size={18}
                        strokeWidth={1.5}
                        className="shrink-0 text-primary-text"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-medium text-slate-900">
                          {dataLabel}
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-600 ml-1">{horaLabel}</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          Anamnese: {a.template_nome ?? "Sem template"}
                        </p>
                      </div>
                      {expandido ? (
                        <ChevronUp
                          size={16}
                          strokeWidth={1.5}
                          className="text-slate-500 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown
                          size={16}
                          strokeWidth={1.5}
                          className="text-slate-500 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                    {expandido ? (
                      <div className="border-t border-slate-100 px-3 py-3">
                        <AnamneseDetalhe anamnese={a} />
                      </div>
                    ) : null}
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
