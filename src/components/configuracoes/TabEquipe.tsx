"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Loader2,
  Mail,
  Percent,
  RotateCcw,
  Shield,
  ShieldOff,
  UserPlus,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  alterarAtivoProfissional,
  alterarRole,
  getResumoEquipe,
  listarEquipe,
  type ProfissionalEquipe,
  type ResumoEquipe,
} from "@/actions/equipe";
import {
  getComissoesTenant,
  type ComissaoProfissionalComNome,
} from "@/actions/comissoes";
import { formatCurrency } from "@/lib/masks";
import ModalComissao from "./ModalComissao";
import {
  cancelarConvite,
  convidarProfissional,
  listarConvites,
  type Convite,
  type ConviteRole,
} from "@/actions/convites";
import {
  ROLE_BADGE_CLASS,
  ROLE_LABEL,
  type Role,
} from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[14px] font-medium text-slate-900";

function formatExpira(iso: string): string {
  const d = new Date(iso);
  const dias = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return "Expirado";
  if (dias === 1) return "Expira em 1 dia";
  return `Expira em ${dias} dias`;
}

const STATUS_CONVITE_LABEL: Record<Convite["status"], string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const STATUS_CONVITE_CLASS: Record<Convite["status"], string> = {
  pendente: "bg-amber-100 text-amber-700",
  aceito: "bg-[#D1FAE5] text-[#065F46]",
  cancelado: "bg-slate-200 text-slate-600",
  expirado: "bg-red-100 text-red-700",
};

function TabEquipe() {
  const [equipe, setEquipe] = useState<ProfissionalEquipe[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [resumo, setResumo] = useState<ResumoEquipe | null>(null);
  const [comissoes, setComissoes] = useState<ComissaoProfissionalComNome[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [convidarOpen, setConvidarOpen] = useState(false);
  const [comissaoTarget, setComissaoTarget] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const recarregar = useCallback(() => {
    startTransition(async () => {
      const [eq, cv, rs, cm] = await Promise.all([
        listarEquipe(),
        listarConvites(),
        getResumoEquipe(),
        getComissoesTenant(),
      ]);
      if (eq.ok) setEquipe(eq.data);
      else setErro(eq.error);
      if (cv.ok) setConvites(cv.data);
      if (rs.ok) setResumo(rs.data);
      if (cm.ok) setComissoes(cm.data);
    });
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [eq, cv, rs, cm] = await Promise.all([
        listarEquipe(),
        listarConvites(),
        getResumoEquipe(),
        getComissoesTenant(),
      ]);
      if (cancelado) return;
      if (eq.ok) setEquipe(eq.data);
      else setErro(eq.error);
      if (cv.ok) setConvites(cv.data);
      if (rs.ok) setResumo(rs.data);
      if (cm.ok) setComissoes(cm.data);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const comissoesPorProf = new Map(
    comissoes.map((c) => [c.profissional_id, c]),
  );

  const conviteslPendentes = convites.filter(
    (c) => c.status === "pendente" || c.status === "expirado",
  );
  const ativos = equipe.filter((p) => p.ativo).length;
  const limite = resumo?.max ?? 1;
  const podeConvidar =
    !!resumo && ativos + (resumo?.pendentes ?? 0) < limite;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Equipe</h2>
          <p className="text-xs text-slate-500">
            {resumo
              ? `${ativos} de ${limite} ${limite === 1 ? "profissional" : "profissionais"} (plano ${resumo.plano})`
              : "Carregando..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConvidarOpen(true)}
          disabled={!podeConvidar}
          title={!podeConvidar ? "Limite do plano atingido" : undefined}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <UserPlus size={14} strokeWidth={1.5} aria-hidden="true" />
          Convidar profissional
        </button>
      </header>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Profissionais
        </h3>
        {carregando ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : equipe.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum profissional cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {equipe.map((p) => (
              <ItemProfissional
                key={p.id}
                prof={p}
                comissao={comissoesPorProf.get(p.id) ?? null}
                onChanged={recarregar}
                onAbrirComissao={() =>
                  setComissaoTarget({ id: p.id, nome: p.nome })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {conviteslPendentes.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Convites pendentes
          </h3>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {conviteslPendentes.map((c) => (
              <ItemConvite key={c.id} convite={c} onChanged={recarregar} />
            ))}
          </ul>
        </section>
      ) : null}

      <ConvidarModal
        key={`convidar-${convidarOpen ? "open" : "closed"}`}
        open={convidarOpen}
        onOpenChange={setConvidarOpen}
        onConvidado={recarregar}
        podeConvidar={podeConvidar}
      />

      {comissaoTarget ? (
        <ModalComissao
          key={`comissao-${comissaoTarget.id}`}
          open={true}
          onOpenChange={(next) => {
            if (!next) setComissaoTarget(null);
          }}
          profissional={comissaoTarget}
          onSaved={recarregar}
        />
      ) : null}
    </div>
  );
}

function descreverComissao(c: ComissaoProfissionalComNome): string {
  const partes: string[] = [];
  if (c.tipo_cobranca === "percentual" || c.tipo_cobranca === "misto") {
    if (c.percentual > 0) {
      partes.push(`${String(c.percentual).replace(".", ",")}%`);
    }
  }
  if (c.tipo_cobranca === "fixo" || c.tipo_cobranca === "misto") {
    if (c.valor_fixo_mensal > 0) {
      partes.push(formatCurrency(c.valor_fixo_mensal));
    }
  }
  return partes.length > 0 ? partes.join(" + ") : "Configurada";
}

function ItemProfissional({
  prof,
  comissao,
  onChanged,
  onAbrirComissao,
}: {
  prof: ProfissionalEquipe;
  comissao: ComissaoProfissionalComNome | null;
  onChanged: () => void;
  onAbrirComissao: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const role = prof.role as Role;
  const badgeCls = ROLE_BADGE_CLASS[role] ?? "bg-slate-100 text-slate-700";

  const handleAlterarRole = (novo: "admin" | "profissional" | "secretaria") => {
    setErro(null);
    startTransition(async () => {
      const r = await alterarRole(prof.id, novo);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      onChanged();
    });
  };

  const handleToggleAtivo = () => {
    setErro(null);
    if (prof.ativo) {
      if (!confirm(`Desativar ${prof.nome}? Eles não poderão mais acessar.`)) {
        return;
      }
    }
    startTransition(async () => {
      const r = await alterarAtivoProfissional(prof.id, !prof.ativo);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      onChanged();
    });
  };

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4",
        !prof.ativo && "opacity-60",
      )}
    >
      <Avatar name={prof.nome} className="h-9 w-9 text-[13px] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900 truncate">
            {prof.nome}
          </p>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              badgeCls,
            )}
          >
            {ROLE_LABEL[role] ?? role}
          </span>
          {prof.is_self ? (
            <span className="text-[10px] text-slate-500">(você)</span>
          ) : null}
          {!prof.ativo ? (
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              Inativo
            </span>
          ) : null}
          {comissao && comissao.ativo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Percent
                size={9}
                strokeWidth={2}
                aria-hidden="true"
              />
              {descreverComissao(comissao)}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500 truncate">
          {prof.email} · {prof.especialidade}
        </p>
        {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {prof.role !== "admin" && prof.ativo ? (
          <button
            type="button"
            onClick={onAbrirComissao}
            disabled={isPending}
            aria-label="Configurar comissao"
            title="Comissao"
            className="inline-flex items-center gap-1 rounded border border-primary px-2 py-1 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors disabled:opacity-50"
          >
            <Percent size={12} strokeWidth={1.75} aria-hidden="true" />
            Comissao
          </button>
        ) : null}
        <select
          value={role}
          onChange={(e) =>
            handleAlterarRole(
              e.target.value as "admin" | "profissional" | "secretaria",
            )
          }
          disabled={isPending || (prof.is_self && prof.role === "admin")}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-primary focus:outline-none disabled:opacity-50"
        >
          <option value="admin">Administrador</option>
          <option value="profissional">Profissional</option>
          <option value="secretaria">Secretária</option>
        </select>
        {!prof.is_self ? (
          <button
            type="button"
            onClick={handleToggleAtivo}
            disabled={isPending}
            aria-label={prof.ativo ? "Desativar" : "Reativar"}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50",
              prof.ativo ? "hover:text-red-600" : "hover:text-primary-text",
            )}
            title={prof.ativo ? "Desativar" : "Reativar"}
          >
            {prof.ativo ? (
              <ShieldOff size={14} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Shield size={14} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function ItemConvite({
  convite,
  onChanged,
}: {
  convite: Convite;
  onChanged: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCancelar = () => {
    setErro(null);
    if (!confirm(`Cancelar convite para ${convite.email}?`)) return;
    startTransition(async () => {
      const r = await cancelarConvite(convite.id);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      onChanged();
    });
  };

  const handleReenviar = () => {
    setErro(null);
    startTransition(async () => {
      // cancela o atual e cria um novo
      const cancel = await cancelarConvite(convite.id);
      if (!cancel.ok) {
        setErro(cancel.error);
        return;
      }
      const novo = await convidarProfissional({
        email: convite.email,
        nome: convite.nome,
        role: convite.role as ConviteRole,
      });
      if (!novo.ok) {
        setErro(novo.error);
        return;
      }
      onChanged();
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Mail size={14} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900 truncate">
            {convite.nome}
          </p>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              STATUS_CONVITE_CLASS[convite.status],
            )}
          >
            {STATUS_CONVITE_LABEL[convite.status]}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate">
          {convite.email}
          {convite.status === "pendente" ? (
            <>
              <span className="mx-1 text-slate-300">·</span>
              {formatExpira(convite.expira_em)}
            </>
          ) : null}
        </p>
        {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {convite.status === "expirado" ? (
          <button
            type="button"
            onClick={handleReenviar}
            disabled={isPending}
            aria-label="Reenviar convite"
            title="Reenviar"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : null}
        {convite.status === "pendente" ? (
          <button
            type="button"
            onClick={handleCancelar}
            disabled={isPending}
            aria-label="Cancelar convite"
            title="Cancelar"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function ConvidarModal({
  open,
  onOpenChange,
  onConvidado,
  podeConvidar,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConvidado: () => void;
  podeConvidar: boolean;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ConviteRole>("profissional");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSalvar = () => {
    setErro(null);
    if (!podeConvidar) {
      setErro("Limite do plano atingido.");
      return;
    }
    startTransition(async () => {
      const r = await convidarProfissional({ email, nome, role });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      onOpenChange(false);
      onConvidado();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />
          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Convidar profissional
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className={labelClass}>Nome *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@dominio.com"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Função *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ConviteRole)}
                className={inputClass}
              >
                <option value="profissional">Profissional</option>
                <option value="secretaria">Secretária</option>
              </select>
            </div>

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}

            {!podeConvidar ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Limite do plano atingido.
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={isPending || !podeConvidar || !nome || !email}
              className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2
                    size={14}
                    strokeWidth={1.5}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Enviando...
                </>
              ) : (
                "Enviar convite"
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default TabEquipe;
