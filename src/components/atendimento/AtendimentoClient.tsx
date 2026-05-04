"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateAge } from "@/lib/validators";
import { cn } from "@/lib/utils";
import type { CampoTemplate } from "@/actions/anamnese";
import { criarEvolucao } from "@/actions/evolucoes";
import { atualizarStatusAgendamento } from "@/actions/agendamentos";
import { getTemplates, type Template } from "@/actions/anamnese";
import AnamneseDetalhe from "@/components/pacientes/AnamneseDetalhe";
import FormNovaAnamnese from "@/components/pacientes/FormNovaAnamnese";
import GravadorAudio from "./GravadorAudio";

export type AtendimentoContexto = {
  agendamento: {
    id: string;
    data_hora: string;
    duracao_min: number;
    status:
      | "agendado"
      | "confirmado"
      | "em_atendimento"
      | "concluido"
      | "faltou"
      | "cancelado";
    procedimento_nome: string | null;
  };
  paciente: {
    id: string;
    nome: string;
    data_nascimento: string;
    genero: "masculino" | "feminino" | "prefiro_nao_informar";
  };
  isRetorno: boolean;
  ultimaConsulta: string | null;
  anamnese: {
    id: string;
    created_at: string;
    template_nome: string | null;
    template_campos: CampoTemplate[];
    dados: Record<string, unknown>;
  } | null;
  evolucoesAnteriores: Array<{
    id: string;
    created_at: string;
    texto: string | null;
    transcricao: string | null;
  }>;
};

interface AtendimentoClientProps {
  contexto: AtendimentoContexto;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";

function AtendimentoClient({ contexto }: AtendimentoClientProps) {
  const router = useRouter();
  const idade = calculateAge(contexto.paciente.data_nascimento);

  const [observacoes, setObservacoes] = useState("");
  const [transcricao, setTranscricao] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [receita, setReceita] = useState("");
  const [diagnostico, setDiagnostico] = useState("");

  const [anamneseExpandida, setAnamneseExpandida] = useState(true);
  const [historicoExpandido, setHistoricoExpandido] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isConcluindo, startConcluir] = useTransition();

  const [openAnamneseForm, setOpenAnamneseForm] = useState(false);
  const [templatesAnamnese, setTemplatesAnamnese] = useState<Template[]>([]);
  const [carregandoTemplates, setCarregandoTemplates] = useState(false);
  const [anamneseAtual, setAnamneseAtual] = useState(contexto.anamnese);

  const abrirNovaAnamnese = async () => {
    setErro(null);
    if (templatesAnamnese.length === 0) {
      setCarregandoTemplates(true);
      const r = await getTemplates();
      setCarregandoTemplates(false);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setTemplatesAnamnese(r.data);
    }
    setOpenAnamneseForm(true);
  };

  const handleAnamneseCriada = async () => {
    // Recarrega so a do paciente — server retornaria, mas vamos refazer com fetch simples.
    // O page.tsx renderiza no proximo navigate; aqui apenas marcamos que ha anamnese.
    setAnamneseAtual({
      id: "novo",
      created_at: new Date().toISOString(),
      template_nome: anamneseAtual?.template_nome ?? "Anamnese",
      template_campos: anamneseAtual?.template_campos ?? [],
      dados: {},
    });
    router.refresh();
  };

  const handleUsarTranscricao = (texto: string) => {
    setObservacoes((prev) => {
      const sep = prev.trim().length > 0 ? "\n\n" : "";
      return `${prev}${sep}${texto}`;
    });
    setTranscricao(texto);
    setOkMsg("Transcrição inserida nas observações.");
    window.setTimeout(() => setOkMsg(null), 2500);
  };

  const handleAudioPronto = (info: { url: string; transcricao: string }) => {
    setAudioUrl(info.url);
    setTranscricao(info.transcricao);
  };

  const buildPayload = () => ({
    pacienteId: contexto.paciente.id,
    agendamentoId: contexto.agendamento.id,
    anamneseId:
      anamneseAtual && anamneseAtual.id !== "novo" ? anamneseAtual.id : undefined,
    texto: observacoes,
    audioUrl: audioUrl ?? undefined,
    transcricao: transcricao || undefined,
    receita,
    diagnostico,
  });

  const handleSalvarRascunho = () => {
    setErro(null);
    startSave(async () => {
      const r = await criarEvolucao(buildPayload());
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOkMsg("Rascunho salvo.");
      window.setTimeout(() => setOkMsg(null), 2500);
    });
  };

  const handleConcluir = () => {
    setErro(null);
    startConcluir(async () => {
      const ev = await criarEvolucao(buildPayload());
      if (!ev.ok) {
        setErro(ev.error);
        return;
      }
      const st = await atualizarStatusAgendamento(
        contexto.agendamento.id,
        "concluido",
      );
      if (!st.ok) {
        setErro(st.error);
        return;
      }
      router.push("/agenda");
    });
  };

  const dataHora = new Date(contexto.agendamento.data_hora);
  const horario = format(dataHora, "HH:mm", { locale: ptBR });

  return (
    <div className="space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <Link
          href="/agenda"
          aria-label="Voltar para agenda"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold text-slate-900 leading-tight truncate">
            {contexto.paciente.nome}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-[3px] font-medium leading-none",
                contexto.isRetorno
                  ? "bg-primary-surface text-primary-dark"
                  : "bg-info-surface text-[#1E40AF]",
              )}
            >
              {contexto.isRetorno ? "Retorno" : "Novo"}
            </span>
            {idade !== null ? (
              <span className="text-slate-500">
                {idade} {idade === 1 ? "ano" : "anos"}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Resumo
            label="Última consulta"
            value={
              contexto.ultimaConsulta
                ? format(new Date(contexto.ultimaConsulta), "dd/MM/yyyy", {
                    locale: ptBR,
                  })
                : "Primeira"
            }
          />
          <Resumo
            label="Procedimento"
            value={contexto.agendamento.procedimento_nome ?? "—"}
          />
          <Resumo
            label="Horário"
            value={`${horario} · ${contexto.agendamento.duracao_min} min`}
            icon={<Clock size={14} strokeWidth={1.5} aria-hidden="true" />}
          />
        </div>
      </section>

      <SecaoColapsavel
        titulo="Anamnese"
        icone={<ClipboardList size={16} strokeWidth={1.5} aria-hidden="true" />}
        aberta={anamneseExpandida}
        onToggle={() => setAnamneseExpandida((v) => !v)}
      >
        {anamneseAtual && anamneseAtual.id !== "novo" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#D1FAE5] px-2.5 py-[3px] text-[11px] font-medium leading-none text-[#065F46]">
                Anamnese preenchida
              </span>
              <p className="text-xs text-slate-500">
                {anamneseAtual.template_nome ?? "Anamnese"} ·{" "}
                {format(new Date(anamneseAtual.created_at), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <AnamneseDetalhe
              anamnese={{
                id: anamneseAtual.id,
                tenant_id: "",
                paciente_id: contexto.paciente.id,
                profissional_id: "",
                agendamento_id: null,
                template_id: null,
                template_nome: anamneseAtual.template_nome,
                template_campos: anamneseAtual.template_campos,
                dados: anamneseAtual.dados,
                audio_url: null,
                created_at: anamneseAtual.created_at,
                updated_at: anamneseAtual.created_at,
              }}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-500">
              Nenhuma anamnese registrada para este paciente.
            </p>
            <button
              type="button"
              onClick={abrirNovaAnamnese}
              disabled={carregandoTemplates}
              className="mt-3 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {carregandoTemplates ? "Carregando..." : "Preencher anamnese"}
            </button>
          </div>
        )}
      </SecaoColapsavel>

      <SecaoColapsavel
        titulo="Histórico"
        icone={<FileText size={16} strokeWidth={1.5} aria-hidden="true" />}
        aberta={historicoExpandido}
        onToggle={() => setHistoricoExpandido((v) => !v)}
      >
        {contexto.evolucoesAnteriores.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma evolução anterior registrada.
          </p>
        ) : (
          <ul className="space-y-2">
            {contexto.evolucoesAnteriores.map((ev) => {
              const dt = new Date(ev.created_at);
              const data = format(dt, "dd/MM/yyyy HH:mm", { locale: ptBR });
              const corpo = (ev.texto ?? ev.transcricao ?? "").trim();
              const resumo =
                corpo.length > 200 ? `${corpo.slice(0, 200)}…` : corpo;
              return (
                <li
                  key={ev.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <p className="text-xs font-medium text-slate-500">{data}</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                    {resumo || (
                      <span className="italic text-slate-400">Sem texto</span>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </SecaoColapsavel>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Evolução atual
        </h2>

        <div className="space-y-1">
          <label className="block text-[13px] font-medium text-slate-700">
            Observações clínicas
          </label>
          <textarea
            rows={5}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Descreva a sessão, sintomas observados, condutas..."
            className={`${inputClass} resize-y`}
          />
        </div>

        <GravadorAudio
          pacienteId={contexto.paciente.id}
          onUsarTranscricao={handleUsarTranscricao}
          onAudioPronto={handleAudioPronto}
        />

        <div className="space-y-1">
          <label className="block text-[13px] font-medium text-slate-700">
            Receita / Prescrição
          </label>
          <textarea
            rows={3}
            value={receita}
            onChange={(e) => setReceita(e.target.value)}
            placeholder="Medicamentos, dosagem, frequência..."
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[13px] font-medium text-slate-700">
            Diagnóstico
          </label>
          <textarea
            rows={3}
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
            placeholder="CID-10, hipóteses diagnósticas..."
            className={`${inputClass} resize-y`}
          />
        </div>
      </section>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {okMsg}
        </p>
      ) : null}
      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(56px+env(safe-area-inset-bottom))] lg:bottom-4 z-20 -mx-4 sm:mx-0 border-t border-slate-200 bg-white px-4 py-3 sm:rounded-lg sm:border sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSalvarRascunho}
            disabled={isSaving || isConcluindo}
            className="rounded border border-primary bg-transparent px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary-surface transition-colors disabled:opacity-50"
          >
            {isSaving ? "Salvando..." : "Salvar rascunho"}
          </button>
          <button
            type="button"
            onClick={handleConcluir}
            disabled={isSaving || isConcluindo}
            className="rounded bg-[#16A34A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15803D] transition-colors disabled:opacity-50"
          >
            {isConcluindo ? "Concluindo..." : "Concluir atendimento"}
          </button>
        </div>
      </div>

      <FormNovaAnamnese
        key={`form-${openAnamneseForm ? "open" : "closed"}`}
        open={openAnamneseForm}
        onOpenChange={setOpenAnamneseForm}
        pacienteId={contexto.paciente.id}
        templates={templatesAnamnese}
        onSaved={handleAnamneseCriada}
      />
    </div>
  );
}

function Resumo({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        {value}
      </p>
    </div>
  );
}

function SecaoColapsavel({
  titulo,
  icone,
  aberta,
  onToggle,
  children,
}: {
  titulo: string;
  icone?: React.ReactNode;
  aberta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors rounded-lg hover:bg-slate-50"
      >
        {icone ? <span className="text-slate-500">{icone}</span> : null}
        <h2 className="flex-1 text-base font-semibold text-slate-900">
          {titulo}
        </h2>
        {aberta ? (
          <ChevronUp size={16} strokeWidth={1.5} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.5} className="text-slate-400" />
        )}
      </button>
      {aberta ? (
        <div className="border-t border-slate-100 px-4 py-3">{children}</div>
      ) : null}
    </section>
  );
}

export default AtendimentoClient;
