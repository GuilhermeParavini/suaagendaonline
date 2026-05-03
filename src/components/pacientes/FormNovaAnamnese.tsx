"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, X } from "lucide-react";
import {
  criarAnamnese,
  uploadFotoAnamnese,
  type CampoTemplate,
  type Template,
} from "@/actions/anamnese";
import { cn } from "@/lib/utils";

interface FormNovaAnamneseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  templates: Template[];
  onSaved: () => void;
}

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";

type Valores = Record<string, string | string[] | boolean | number | null>;

function valorInicial(c: CampoTemplate): Valores[string] {
  switch (c.tipo) {
    case "selecao_multipla":
      return [];
    case "sim_nao":
      return null;
    case "escala_numerica": {
      const min = typeof c.min === "number" ? c.min : 0;
      const max = typeof c.max === "number" ? c.max : 10;
      return Math.round((min + max) / 2);
    }
    case "data":
      return "";
    case "upload_foto":
      return "";
    default:
      return "";
  }
}

function camposOrdenados(template: Template | null): CampoTemplate[] {
  if (!template) return [];
  return template.campos.slice().sort((a, b) => a.ordem - b.ordem);
}

function FormNovaAnamnese({
  open,
  onOpenChange,
  pacienteId,
  templates,
  onSaved,
}: FormNovaAnamneseProps) {
  const ativos = templates.filter((t) => t.ativo);
  const [templateId, setTemplateId] = useState<string>(
    ativos[0]?.id ?? "",
  );
  const templateAtual = ativos.find((t) => t.id === templateId) ?? null;

  const [valores, setValores] = useState<Valores>(() => {
    const init: Valores = {};
    for (const c of camposOrdenados(templateAtual)) {
      init[c.id] = valorInicial(c);
    }
    return init;
  });
  const [erro, setErro] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const handleTrocarTemplate = (novoId: string) => {
    setTemplateId(novoId);
    const novo = ativos.find((t) => t.id === novoId) ?? null;
    const init: Valores = {};
    for (const c of camposOrdenados(novo)) {
      init[c.id] = valorInicial(c);
    }
    setValores(init);
    setErro(null);
    setErroCampo({});
  };

  const setValor = (id: string, valor: Valores[string]) => {
    setValores((prev) => ({ ...prev, [id]: valor }));
    setErroCampo((prev) => {
      if (!prev[id]) return prev;
      const novo = { ...prev };
      delete novo[id];
      return novo;
    });
  };

  const toggleOpcao = (id: string, opcao: string) => {
    setValores((prev) => {
      const atual = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const ja = atual.includes(opcao);
      return {
        ...prev,
        [id]: ja
          ? atual.filter((o) => o !== opcao)
          : [...atual, opcao],
      };
    });
  };

  const handleUpload = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading((prev) => ({ ...prev, [id]: true }));
    try {
      const fd = new FormData();
      fd.set("arquivo", f);
      const result = await uploadFotoAnamnese(fd);
      if (!result.ok) {
        setErroCampo((prev) => ({ ...prev, [id]: result.error }));
        return;
      }
      setValor(id, result.data.url);
    } finally {
      setUploading((prev) => {
        const novo = { ...prev };
        delete novo[id];
        return novo;
      });
    }
  };

  const handleSalvar = () => {
    if (!templateAtual) {
      setErro("Selecione um template.");
      return;
    }
    setErro(null);
    const errosCampo: Record<string, string> = {};

    const dadosFinal: Record<string, unknown> = {};
    for (const c of camposOrdenados(templateAtual)) {
      const v = valores[c.id];
      switch (c.tipo) {
        case "texto_livre": {
          const s = typeof v === "string" ? v.trim() : "";
          if (c.obrigatorio && s.length === 0) {
            errosCampo[c.id] = "Campo obrigatório.";
          }
          if (s.length > 0) dadosFinal[c.id] = s;
          break;
        }
        case "selecao_multipla": {
          const arr = Array.isArray(v) ? v : [];
          if (c.obrigatorio && arr.length === 0) {
            errosCampo[c.id] = "Selecione ao menos uma opção.";
          }
          if (arr.length > 0) dadosFinal[c.id] = arr;
          break;
        }
        case "sim_nao": {
          if (c.obrigatorio && typeof v !== "boolean") {
            errosCampo[c.id] = "Campo obrigatório.";
          }
          if (typeof v === "boolean") dadosFinal[c.id] = v;
          break;
        }
        case "escala_numerica": {
          if (typeof v === "number") dadosFinal[c.id] = v;
          else if (c.obrigatorio) errosCampo[c.id] = "Campo obrigatório.";
          break;
        }
        case "data": {
          const s = typeof v === "string" ? v : "";
          if (c.obrigatorio && !s) {
            errosCampo[c.id] = "Campo obrigatório.";
          }
          if (s) dadosFinal[c.id] = s;
          break;
        }
        case "upload_foto": {
          const s = typeof v === "string" ? v : "";
          if (c.obrigatorio && !s) {
            errosCampo[c.id] = "Foto obrigatória.";
          }
          if (s) dadosFinal[c.id] = s;
          break;
        }
      }
    }

    if (Object.keys(errosCampo).length > 0) {
      setErroCampo(errosCampo);
      setErro("Preencha os campos obrigatórios.");
      return;
    }

    startTransition(async () => {
      const result = await criarAnamnese({
        pacienteId,
        templateId: templateAtual.id,
        dados: dadosFinal,
      });
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      onOpenChange(false);
      onSaved();
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
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[640px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Nova anamnese
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          {ativos.length === 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
              Nenhum template ativo. Crie um em Configurações &gt; Anamnese.
            </div>
          ) : (
            <>
              {ativos.length > 1 ? (
                <div className="mt-4 space-y-1 shrink-0">
                  <label className="block text-[13px] font-medium text-slate-700">
                    Template
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => handleTrocarTemplate(e.target.value)}
                    className={inputClass}
                  >
                    {ativos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500 shrink-0">
                  Template:{" "}
                  <span className="font-medium text-slate-700">
                    {templateAtual?.nome}
                  </span>
                </p>
              )}

              <div className="mt-4 space-y-4 overflow-y-auto pb-2">
                {camposOrdenados(templateAtual).map((c) => (
                  <CampoRender
                    key={c.id}
                    campo={c}
                    valor={valores[c.id]}
                    erro={erroCampo[c.id]}
                    uploading={Boolean(uploading[c.id])}
                    onChange={(v) => setValor(c.id, v)}
                    onToggleOpcao={(o) => toggleOpcao(c.id, o)}
                    onUpload={(e) => handleUpload(c.id, e)}
                  />
                ))}
              </div>

              {erro ? (
                <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {erro}
                </p>
              ) : null}

              <div className="mt-3 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isPending}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Salvar anamnese"}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface CampoRenderProps {
  campo: CampoTemplate;
  valor: Valores[string];
  erro: string | undefined;
  uploading: boolean;
  onChange: (valor: Valores[string]) => void;
  onToggleOpcao: (opcao: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function CampoRender({
  campo,
  valor,
  erro,
  uploading,
  onChange,
  onToggleOpcao,
  onUpload,
}: CampoRenderProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-slate-700">
        {campo.label}
        {campo.obrigatorio ? (
          <span className="ml-0.5 text-red-500">*</span>
        ) : null}
      </label>

      {campo.tipo === "texto_livre" ? (
        <textarea
          rows={3}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} resize-y`}
        />
      ) : null}

      {campo.tipo === "selecao_multipla" ? (
        <div className="space-y-1.5">
          {(campo.opcoes ?? []).map((opt) => {
            const checked = Array.isArray(valor) && valor.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleOpcao(opt)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                />
                <span className="text-slate-700">{opt}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      {campo.tipo === "sim_nao" ? (
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => onChange(true)}
            className={cn(
              "rounded px-4 py-1.5 text-sm font-medium transition-colors",
              valor === true
                ? "bg-primary text-white"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Sim
          </button>
          <button
            type="button"
            onClick={() => onChange(false)}
            className={cn(
              "rounded px-4 py-1.5 text-sm font-medium transition-colors",
              valor === false
                ? "bg-slate-700 text-white"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Não
          </button>
        </div>
      ) : null}

      {campo.tipo === "escala_numerica"
        ? (() => {
            const min = typeof campo.min === "number" ? campo.min : 0;
            const max = typeof campo.max === "number" ? campo.max : 10;
            const v =
              typeof valor === "number"
                ? valor
                : Math.round((min + max) / 2);
            return (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={v}
                  onChange={(e) => onChange(Number(e.target.value))}
                  className="flex-1 accent-[#0D9488]"
                />
                <span className="inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg bg-primary-surface px-2 text-sm font-semibold text-primary-dark">
                  {v}
                </span>
              </div>
            );
          })()
        : null}

      {campo.tipo === "data" ? (
        <input
          type="date"
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      ) : null}

      {campo.tipo === "upload_foto" ? (
        <div className="space-y-2">
          <input
            type="file"
            id={`anamnese-${campo.id}`}
            accept="image/*"
            onChange={onUpload}
            className="hidden"
          />
          <label
            htmlFor={`anamnese-${campo.id}`}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface transition-colors",
              uploading && "opacity-50 cursor-not-allowed",
            )}
          >
            <Upload size={13} strokeWidth={1.5} aria-hidden="true" />
            {uploading ? "Enviando..." : "Escolher imagem"}
          </label>
          {typeof valor === "string" && valor.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={valor}
              alt={`Foto - ${campo.label}`}
              className="block max-h-[140px] rounded border border-slate-200 object-contain"
            />
          ) : null}
        </div>
      ) : null}

      {erro ? <p className="text-xs text-red-600">{erro}</p> : null}
    </div>
  );
}

export default FormNovaAnamnese;
