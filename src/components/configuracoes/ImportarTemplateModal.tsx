"use client";

import { useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  criarTemplate,
  type CampoTemplate,
  type CampoTipo,
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

const FORMATOS_VALIDOS = [".txt", ".pdf", ".docx"] as const;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 30000;

interface ImportarTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  especialidadeDefault: string;
  onSaved: () => void;
}

type Etapa = "selecionar" | "preview";

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function arquivoSuportado(arquivo: File): boolean {
  const nome = arquivo.name.toLowerCase();
  return FORMATOS_VALIDOS.some((ext) => nome.endsWith(ext));
}

function reordenar(lista: CampoTemplate[]): CampoTemplate[] {
  return lista.map((c, i) => ({ ...c, ordem: i + 1 }));
}

function ImportarTemplateModal({
  open,
  onOpenChange,
  especialidadeDefault,
  onSaved,
}: ImportarTemplateModalProps) {
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("selecionar");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [nomeInicial, setNomeInicial] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [textoBruto, setTextoBruto] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [especialidade, setEspecialidade] = useState(especialidadeDefault);
  const [campos, setCampos] = useState<CampoTemplate[]>([]);

  const [processando, startProcessar] = useTransition();
  const [salvando, startSalvar] = useTransition();

  const resetar = () => {
    setEtapa("selecionar");
    setArquivo(null);
    setNomeInicial("");
    setDragOver(false);
    setErro(null);
    setTextoBruto(null);
    setNome("");
    setEspecialidade(especialidadeDefault);
    setCampos([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetar();
    onOpenChange(next);
  };

  const handleSelecionarArquivo = (file: File | null) => {
    setErro(null);
    setTextoBruto(null);
    if (!file) {
      setArquivo(null);
      return;
    }
    if (!arquivoSuportado(file)) {
      setErro("Formato não suportado. Use TXT, PDF ou DOCX.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErro("Arquivo acima de 2MB.");
      return;
    }
    setArquivo(file);
  };

  const handleProcessar = () => {
    if (!arquivo) return;
    setErro(null);
    setTextoBruto(null);
    startProcessar(async () => {
      const fd = new FormData();
      fd.set("arquivo", arquivo);
      if (nomeInicial.trim()) fd.set("nome_template", nomeInicial.trim());

      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);

      let resposta: Response;
      try {
        resposta = await fetch("/api/importar-anamnese", {
          method: "POST",
          body: fd,
          signal: ctrl.signal,
        });
      } catch (e) {
        window.clearTimeout(timer);
        if (e instanceof DOMException && e.name === "AbortError") {
          setErro("Processamento demorou demais. Tente novamente.");
          return;
        }
        setErro(e instanceof Error ? e.message : "Falha de rede.");
        return;
      }
      window.clearTimeout(timer);

      let json: {
        nome_sugerido?: string;
        especialidade_sugerida?: string;
        campos?: Array<{
          label: string;
          tipo: CampoTipo;
          obrigatorio: boolean;
          opcoes?: string[];
          min?: number;
          max?: number;
        }>;
        erro?: string;
        texto?: string;
      };
      try {
        json = await resposta.json();
      } catch {
        setErro("Resposta inválida do servidor.");
        return;
      }

      if (!resposta.ok || !json.campos || json.campos.length === 0) {
        if (typeof json.texto === "string" && json.texto.length > 0) {
          setTextoBruto(json.texto);
        }
        setErro(json.erro ?? "Não foi possível processar o documento.");
        return;
      }

      const camposComId: CampoTemplate[] = json.campos.map((c, i) => ({
        id: crypto.randomUUID(),
        label: c.label,
        tipo: c.tipo,
        obrigatorio: Boolean(c.obrigatorio),
        ordem: i + 1,
        ...(c.tipo === "selecao_multipla"
          ? { opcoes: c.opcoes ?? [] }
          : {}),
        ...(c.tipo === "escala_numerica"
          ? {
              min: typeof c.min === "number" ? c.min : 0,
              max: typeof c.max === "number" ? c.max : 10,
            }
          : {}),
      }));

      setCampos(camposComId);
      setNome(json.nome_sugerido ?? nomeInicial.trim() ?? "Anamnese importada");
      setEspecialidade(
        (json.especialidade_sugerida ?? "").trim() || especialidadeDefault,
      );
      setEtapa("preview");
    });
  };

  const criarManualmente = () => {
    setCampos([
      {
        id: crypto.randomUUID(),
        label: "Queixa principal",
        tipo: "texto_livre",
        obrigatorio: true,
        ordem: 1,
      },
    ]);
    setNome(nomeInicial.trim() || "Anamnese importada");
    setEspecialidade(especialidadeDefault);
    setErro(null);
    setTextoBruto(null);
    setEtapa("preview");
  };

  const adicionarCampo = () => {
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

  const removerCampo = (id: string) => {
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

  const atualizarCampo = (id: string, patch: Partial<CampoTemplate>) => {
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

    startSalvar(async () => {
      const r = await criarTemplate({
        nome: nomeTrim,
        especialidade: espTrim,
        campos: camposLimpos,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      handleOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
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
              {etapa === "selecionar"
                ? "Importar modelo de anamnese"
                : "Revisar e salvar"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto pb-2">
            {etapa === "selecionar" ? (
              <>
                <p className="text-sm text-slate-500">
                  Envie um arquivo TXT, PDF ou DOCX. A IA tenta identificar os
                  campos da sua anamnese para você revisar antes de salvar.
                </p>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0] ?? null;
                    handleSelecionarArquivo(f);
                  }}
                  className={cn(
                    "rounded-lg border-2 border-dashed bg-slate-50 px-4 py-8 text-center transition-colors",
                    dragOver
                      ? "border-primary bg-primary-surface"
                      : "border-slate-300",
                  )}
                >
                  <Upload
                    size={28}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="mx-auto text-slate-400"
                  />
                  <p className="mt-2 text-sm text-slate-600">
                    Arraste seu arquivo aqui ou
                  </p>
                  <button
                    type="button"
                    onClick={() => inputFileRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
                  >
                    Selecionar arquivo
                  </button>
                  <p className="mt-2 text-[11px] text-slate-400">
                    TXT, PDF ou DOCX · até 2MB
                  </p>
                  <input
                    ref={inputFileRef}
                    type="file"
                    accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) =>
                      handleSelecionarArquivo(e.target.files?.[0] ?? null)
                    }
                    className="hidden"
                  />
                </div>

                {arquivo ? (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <FileText
                      size={20}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="text-primary shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {arquivo.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatarTamanho(arquivo.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setArquivo(null)}
                      aria-label="Remover arquivo"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <label className={labelClass}>
                    Nome do template (opcional)
                  </label>
                  <input
                    type="text"
                    value={nomeInicial}
                    onChange={(e) => setNomeInicial(e.target.value)}
                    placeholder="Se vazio, a IA sugere"
                    className={inputClass}
                  />
                </div>

                {erro ? (
                  <div className="space-y-2">
                    <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {erro}
                    </p>
                    {textoBruto ? (
                      <details className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-slate-700">
                          Ver texto extraído
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-600">
                          {textoBruto}
                        </pre>
                      </details>
                    ) : null}
                    <button
                      type="button"
                      onClick={criarManualmente}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Criar manualmente
                    </button>
                  </div>
                ) : null}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    disabled={processando}
                    className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessar}
                    disabled={!arquivo || processando}
                    className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    {processando ? (
                      <>
                        <Loader2
                          size={14}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="animate-spin"
                        />
                        Analisando documento...
                      </>
                    ) : (
                      "Processar"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Revise os campos identificados e ajuste antes de salvar.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelClass}>Nome do template *</label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
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
                      onClick={adicionarCampo}
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
                              <ArrowUp
                                size={13}
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => moverCampo(idx, 1)}
                              disabled={idx === campos.length - 1}
                              aria-label="Mover para baixo"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowDown
                                size={13}
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                            </button>
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <input
                              type="text"
                              value={c.label}
                              onChange={(e) =>
                                atualizarCampo(c.id, {
                                  label: e.target.value,
                                })
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
                                    <div
                                      key={j}
                                      className="flex items-center gap-2"
                                    >
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
                                        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                      >
                                        <X
                                          size={13}
                                          strokeWidth={1.5}
                                          aria-hidden="true"
                                        />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => adicionarOpcao(c.id)}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  + Adicionar opção
                                </button>
                              </div>
                            ) : null}

                            {c.tipo === "escala_numerica" ? (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-slate-500">
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
                                  <label className="text-xs font-medium text-slate-500">
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
                            onClick={() => removerCampo(c.id)}
                            aria-label="Remover campo"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          >
                            <Trash2
                              size={14}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
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

                <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEtapa("selecionar")}
                    disabled={salvando}
                    className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleSalvar}
                    disabled={salvando}
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    {salvando ? "Salvando..." : "Salvar template"}
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ImportarTemplateModal;
