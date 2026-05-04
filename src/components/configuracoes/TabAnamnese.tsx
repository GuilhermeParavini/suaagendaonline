"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Copy, Pencil, Plus, Sparkles } from "lucide-react";
import {
  atualizarTemplate,
  duplicarTemplate,
  excluirTemplate,
  getTemplate,
  getTemplates,
  type Template,
} from "@/actions/anamnese";
import { cn } from "@/lib/utils";
import EditorTemplate from "./EditorTemplate";

interface TabAnamneseProps {
  especialidade: string;
}

function TabAnamnese({ especialidade }: TabAnamneseProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editando, setEditando] = useState<Template | null>(null);
  const [carregandoSeed, startSeed] = useTransition();
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setErro(null);
    const result = await getTemplates();
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    setTemplates(result.data);
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      await recarregar();
      if (!cancelado) setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [recarregar]);

  const abrirNovo = () => {
    setEditando(null);
    setEditorOpen(true);
  };

  const abrirEditar = (t: Template) => {
    setEditando(t);
    setEditorOpen(true);
  };

  const duplicarECarregar = async (t: Template) => {
    setErro(null);
    const r = await duplicarTemplate(t.id);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    const novo = await getTemplate(r.data.id);
    if (!novo.ok) {
      setErro(novo.error);
      return;
    }
    await recarregar();
    setEditando(novo.data);
    setEditorOpen(true);
  };

  const handleSeedPadrao = () => {
    setSeedMsg(null);
    setErro(null);

    if (templates.length > 0) {
      const ok = confirm(
        `Você já tem ${templates.length} template(s). Deseja carregar os modelos padrão? Seus templates atuais serão mantidos.`,
      );
      if (!ok) return;
    }

    startSeed(async () => {
      try {
        const resp = await fetch("/api/seed-anamnese");
        const json = (await resp.json()) as {
          sucesso?: boolean;
          inseridos?: number;
          existentes?: number;
          total?: number;
          error?: string;
        };
        if (!resp.ok || !json.sucesso) {
          setErro(json.error ?? "Falha ao carregar templates padrão.");
          return;
        }
        const inseridos = json.inseridos ?? 0;
        const existentes = json.existentes ?? 0;
        if (inseridos === 0) {
          setSeedMsg(
            existentes > 0
              ? `Modelos padrão já estavam cadastrados.`
              : `Nenhum modelo padrão disponível para esta especialidade.`,
          );
        } else {
          setSeedMsg(
            inseridos === 1
              ? `1 modelo carregado.`
              : `${inseridos} modelos carregados.`,
          );
        }
        await recarregar();
        window.setTimeout(() => setSeedMsg(null), 3500);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-slate-500 max-w-md">
          Crie templates de anamnese personalizados. Você pode ter um por
          especialidade ou variações por tipo de atendimento.
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {templates.length > 0 ? (
            <button
              type="button"
              onClick={handleSeedPadrao}
              disabled={carregandoSeed}
              className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-surface transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
              {carregandoSeed ? "Carregando..." : "Carregar modelos padrão"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
            Novo
          </button>
        </div>
      </div>

      {seedMsg && templates.length > 0 ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {seedMsg}
        </p>
      ) : null}

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      {carregando ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center space-y-3">
          <p className="text-sm text-slate-500">
            Nenhum template cadastrado.
          </p>
          <button
            type="button"
            onClick={handleSeedPadrao}
            disabled={carregandoSeed}
            className="inline-flex items-center gap-1.5 rounded border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-surface transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
            {carregandoSeed
              ? "Carregando..."
              : "Carregar templates padrão"}
          </button>
          {seedMsg ? (
            <p className="text-xs font-medium text-[#115E59]">{seedMsg}</p>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {templates.map((t) => (
            <ItemTemplate
              key={t.id}
              template={t}
              onEditar={() => abrirEditar(t)}
              onDuplicar={() => duplicarECarregar(t)}
              onChanged={recarregar}
            />
          ))}
        </ul>
      )}

      <EditorTemplate
        key={`${editando?.id ?? "novo"}-${editorOpen ? "open" : "closed"}`}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editando}
        especialidadeDefault={especialidade}
        onSaved={recarregar}
      />
    </div>
  );
}

function ItemTemplate({
  template,
  onEditar,
  onDuplicar,
  onChanged,
}: {
  template: Template;
  onEditar: () => void;
  onDuplicar: () => void | Promise<void>;
  onChanged: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setErro(null);
    if (template.ativo) {
      if (
        !confirm(
          "Inativar este template? Ele não aparecerá mais na ficha do paciente.",
        )
      ) {
        return;
      }
      startTransition(async () => {
        const result = await excluirTemplate(template.id);
        if (!result.ok) {
          setErro(result.error);
          return;
        }
        onChanged();
      });
    } else {
      startTransition(async () => {
        const result = await atualizarTemplate(template.id, { ativo: true });
        if (!result.ok) {
          setErro(result.error);
          return;
        }
        onChanged();
      });
    }
  };

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-3 py-3 sm:px-4",
        !template.ativo && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900 truncate">
            {template.nome}
          </p>
          {template.padrao ? (
            <span className="inline-flex items-center rounded-full bg-primary-surface px-2 py-0.5 text-[10px] font-medium text-primary-dark">
              Padrão
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {template.especialidade} · {template.campos.length}{" "}
          {template.campos.length === 1 ? "campo" : "campos"}
        </p>
        {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
      </div>

      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={template.ativo}
          onChange={handleToggle}
          disabled={isPending}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
        />
        <span className="text-xs text-slate-600">Ativo</span>
      </label>

      <button
        type="button"
        onClick={() => onDuplicar()}
        disabled={isPending}
        aria-label={`Duplicar ${template.nome}`}
        title="Duplicar"
        className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
      >
        <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${template.nome}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </li>
  );
}

export default TabAnamnese;
