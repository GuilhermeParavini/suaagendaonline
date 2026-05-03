"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  atualizarTemplate,
  criarTemplate,
  type CampoTemplate,
  type CampoTipo,
  type Template,
} from "@/actions/anamnese";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";
const labelClass = "block text-[13px] font-medium text-slate-700";

const TIPOS: { value: CampoTipo; label: string }[] = [
  { value: "texto_livre", label: "Texto livre" },
  { value: "selecao_multipla", label: "Seleção múltipla" },
  { value: "sim_nao", label: "Sim / Não" },
  { value: "escala_numerica", label: "Escala numérica" },
  { value: "data", label: "Data" },
  { value: "upload_foto", label: "Upload de foto" },
];

interface EditorTemplateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  especialidadeDefault: string;
  onSaved: () => void;
}

function camposDefault(): CampoTemplate[] {
  return [
    {
      id: crypto.randomUUID(),
      label: "Queixa principal",
      tipo: "texto_livre",
      obrigatorio: true,
      ordem: 1,
    },
  ];
}

function EditorTemplate({
  open,
  onOpenChange,
  template,
  especialidadeDefault,
  onSaved,
}: EditorTemplateProps) {
  const [nome, setNome] = useState<string>(template?.nome ?? "");
  const [especialidade, setEspecialidade] = useState<string>(
    template?.especialidade ?? especialidadeDefault,
  );
  const [campos, setCampos] = useState<CampoTemplate[]>(() =>
    template
      ? template.campos
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((c) => ({ ...c }))
      : camposDefault(),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editando = template !== null;

  const reordenar = (lista: CampoTemplate[]): CampoTemplate[] =>
    lista.map((c, i) => ({ ...c, ordem: i + 1 }));

  const handleAdicionarCampo = () => {
    setCampos((prev) =>
      reordenar([
        ...prev,
        {
          id: crypto.randomUUID(),
          label: "",
          tipo: "texto_livre",
          obrigatorio: false,
          ordem: prev.length + 1,
        },
      ]),
    );
  };

  const handleRemoverCampo = (id: string) => {
    if (!confirm("Remover este campo?")) return;
    setCampos((prev) => reordenar(prev.filter((c) => c.id !== id)));
  };

  const moverCampo = (index: number, delta: number) => {
    setCampos((prev) => {
      const novo = prev.slice();
      const target = index + delta;
      if (target < 0 || target >= novo.length) return prev;
      [novo[index], novo[target]] = [novo[target], novo[index]];
      return reordenar(novo);
    });
  };

  const atualizarCampo = (
    id: string,
    patch: Partial<CampoTemplate>,
  ) => {
    setCampos((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const adicionarOpcao = (id: string) => {
    setCampos((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const opcoes = c.opcoes ? c.opcoes.slice() : [];
        opcoes.push("");
        return { ...c, opcoes };
      }),
    );
  };

  const alterarOpcao = (id: string, idx: number, valor: string) => {
    setCampos((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const opcoes = c.opcoes ? c.opcoes.slice() : [];
        opcoes[idx] = valor;
        return { ...c, opcoes };
      }),
    );
  };

  const removerOpcao = (id: string, idx: number) => {
    setCampos((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const opcoes = c.opcoes ? c.opcoes.filter((_, j) => j !== idx) : [];
        return { ...c, opcoes };
      }),
    );
  };

  const handleSalvar = () => {
    setErro(null);

    const nomeTrim = nome.trim();
    const espTrim = especialidade.trim();
    if (nomeTrim.length < 2) {
      setErro("Nome do template obrigatório.");
      return;
    }
    if (espTrim.length < 2) {
      setErro("Especialidade obrigatória.");
      return;
    }
    if (campos.length === 0) {
      setErro("Adicione ao menos um campo.");
      return;
    }
    for (const c of campos) {
      if (!c.label.trim()) {
        setErro("Preencha o rótulo de todos os campos.");
        return;
      }
      if (c.tipo === "selecao_multipla") {
        const opcoes = (c.opcoes ?? []).map((o) => o.trim()).filter(Boolean);
        if (opcoes.length < 1) {
          setErro(`Adicione opções no campo "${c.label}".`);
          return;
        }
      }
      if (c.tipo === "escala_numerica") {
        const min = typeof c.min === "number" ? c.min : 0;
        const max = typeof c.max === "number" ? c.max : 10;
        if (max <= min) {
          setErro(`Em "${c.label}", o máximo deve ser maior que o mínimo.`);
          return;
        }
      }
    }

    const camposLimpos: CampoTemplate[] = campos.map((c, i) => {
      const base: CampoTemplate = {
        id: c.id,
        label: c.label.trim(),
        tipo: c.tipo,
        obrigatorio: Boolean(c.obrigatorio),
        ordem: i + 1,
      };
      if (c.tipo === "selecao_multipla") {
        base.opcoes = (c.opcoes ?? [])
          .map((o) => o.trim())
          .filter((o) => o.length > 0);
      }
      if (c.tipo === "escala_numerica") {
        base.min = typeof c.min === "number" ? c.min : 0;
        base.max = typeof c.max === "number" ? c.max : 10;
      }
      return base;
    });

    startTransition(async () => {
      const result = editando
        ? await atualizarTemplate(template.id, {
            nome: nomeTrim,
            especialidade: espTrim,
            campos: camposLimpos,
          })
        : await criarTemplate({
            nome: nomeTrim,
            especialidade: espTrim,
            campos: camposLimpos,
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
              {editando ? "Editar template" : "Novo template"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto pb-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Nome do template *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Anamnese geral"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Especialidade *</label>
                <input
                  type="text"
                  value={especialidade}
                  onChange={(e) => setEspecialidade(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Campos
                </h3>
                <button
                  type="button"
                  onClick={handleAdicionarCampo}
                  className="inline-flex items-center gap-1 rounded border border-primary px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
                >
                  <Plus size={13} strokeWidth={1.5} aria-hidden="true" />
                  Adicionar campo
                </button>
              </div>

              <ul className="space-y-2">
                {campos.map((c, idx) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 space-y-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moverCampo(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Mover para cima"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp size={13} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moverCampo(idx, 1)}
                          disabled={idx === campos.length - 1}
                          aria-label="Mover para baixo"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown size={13} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          type="text"
                          value={c.label}
                          onChange={(e) =>
                            atualizarCampo(c.id, { label: e.target.value })
                          }
                          placeholder="Rótulo do campo"
                          className={inputClass}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select
                            value={c.tipo}
                            onChange={(e) =>
                              atualizarCampo(c.id, {
                                tipo: e.target.value as CampoTipo,
                                opcoes:
                                  e.target.value === "selecao_multipla"
                                    ? c.opcoes ?? []
                                    : undefined,
                                min:
                                  e.target.value === "escala_numerica"
                                    ? c.min ?? 0
                                    : undefined,
                                max:
                                  e.target.value === "escala_numerica"
                                    ? c.max ?? 10
                                    : undefined,
                              })
                            }
                            className={inputClass}
                          >
                            {TIPOS.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>

                          <label className="inline-flex items-center gap-2 px-1">
                            <input
                              type="checkbox"
                              checked={c.obrigatorio}
                              onChange={(e) =>
                                atualizarCampo(c.id, {
                                  obrigatorio: e.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            <span className="text-xs text-slate-700">
                              Obrigatório
                            </span>
                          </label>
                        </div>

                        {c.tipo === "selecao_multipla" ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-500">
                              Opções
                            </p>
                            <div className="space-y-1.5">
                              {(c.opcoes ?? []).map((opt, j) => (
                                <div key={j} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) =>
                                      alterarOpcao(c.id, j, e.target.value)
                                    }
                                    placeholder={`Opção ${j + 1}`}
                                    className={inputClass}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removerOpcao(c.id, j)}
                                    aria-label="Remover opção"
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  >
                                    <X size={13} strokeWidth={1.5} aria-hidden="true" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => adicionarOpcao(c.id)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
                            >
                              <Plus size={12} strokeWidth={1.5} aria-hidden="true" />
                              Adicionar opção
                            </button>
                          </div>
                        ) : null}

                        {c.tipo === "escala_numerica" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-medium text-slate-500">
                                Mínimo
                              </label>
                              <input
                                type="number"
                                value={c.min ?? 0}
                                onChange={(e) =>
                                  atualizarCampo(c.id, {
                                    min: Number(e.target.value),
                                  })
                                }
                                className={inputClass}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-medium text-slate-500">
                                Máximo
                              </label>
                              <input
                                type="number"
                                value={c.max ?? 10}
                                onChange={(e) =>
                                  atualizarCampo(c.id, {
                                    max: Number(e.target.value),
                                  })
                                }
                                className={inputClass}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoverCampo(c.id)}
                        aria-label="Remover campo"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {erro ? (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {erro}
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
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
              {isPending ? "Salvando..." : "Salvar template"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default EditorTemplate;
