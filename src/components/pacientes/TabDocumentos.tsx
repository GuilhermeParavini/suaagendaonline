"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  excluirDocumento,
  getDocumentos,
  getUrlDocumento,
  type CategoriaDocumento,
  type DocumentoPaciente,
} from "@/actions/documentos-paciente";
import { cn } from "@/lib/utils";

interface TabDocumentosProps {
  pacienteId: string;
}

const CATEGORIAS: { value: CategoriaDocumento; label: string }[] = [
  { value: "foto", label: "Foto" },
  { value: "exame", label: "Exame" },
  { value: "laudo", label: "Laudo" },
  { value: "receita", label: "Receita" },
  { value: "outro", label: "Outro" },
];

const CATEGORIA_LABEL: Record<CategoriaDocumento, string> = {
  foto: "Foto",
  exame: "Exame",
  laudo: "Laudo",
  receita: "Receita",
  outro: "Outro",
};

const CATEGORIA_BADGE: Record<CategoriaDocumento, string> = {
  foto: "bg-primary-surface text-primary-dark",
  exame: "bg-info-surface text-[#1E40AF]",
  laudo: "bg-[#F3E8FF] text-[#6B21A8]",
  receita: "bg-[#D1FAE5] text-[#065F46]",
  outro: "bg-slate-100 text-slate-600",
};

const TIPOS_ACEITOS =
  "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

function isImagem(tipo: string): boolean {
  return tipo.startsWith("image/");
}

function formatTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TabDocumentos({ pacienteId }: TabDocumentosProps) {
  const [docs, setDocs] = useState<DocumentoPaciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const [modalUploadAberto, setModalUploadAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDocumento>("outro");
  const [descricao, setDescricao] = useState("");
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [confirmarExclusao, setConfirmarExclusao] =
    useState<DocumentoPaciente | null>(null);
  const [isPendingExcluir, startExcluir] = useTransition();

  const [lightbox, setLightbox] = useState<{
    url: string;
    nome: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const r = await getDocumentos(pacienteId);
    if (!r.ok) {
      setErro(r.error);
      setLoading(false);
      return;
    }
    setDocs(r.documentos);
    setLoading(false);
  }, [pacienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Carrega thumbnails para imagens
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const novas: Record<string, string> = {};
      for (const d of docs) {
        if (!isImagem(d.tipo_arquivo)) continue;
        if (thumbs[d.id]) {
          novas[d.id] = thumbs[d.id];
          continue;
        }
        const r = await getUrlDocumento(d.id);
        if (cancelado) return;
        if (r.ok) novas[d.id] = r.url;
      }
      if (!cancelado) setThumbs((prev) => ({ ...prev, ...novas }));
    })();
    return () => {
      cancelado = true;
    };
    // thumbs intencionalmente fora deps para nao reabrir loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  const resetUpload = () => {
    setArquivo(null);
    setCategoria("outro");
    setDescricao("");
    setErroUpload(null);
    setEnviando(false);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const abrirUpload = () => {
    resetUpload();
    setModalUploadAberto(true);
  };

  const fecharUpload = (next: boolean) => {
    setModalUploadAberto(next);
    if (!next) resetUpload();
  };

  const handleArquivo = (f: File | null) => {
    setErroUpload(null);
    if (!f) {
      setArquivo(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setErroUpload("Arquivo acima de 10MB.");
      return;
    }
    const tiposAceitos = TIPOS_ACEITOS.split(",");
    if (f.type && !tiposAceitos.includes(f.type)) {
      setErroUpload("Tipo invalido. Use JPG, PNG, WebP, HEIC ou PDF.");
      return;
    }
    if (f.type.startsWith("image/")) {
      setCategoria((c) => (c === "outro" ? "foto" : c));
    } else if (f.type === "application/pdf") {
      setCategoria((c) => (c === "outro" ? "exame" : c));
    }
    setArquivo(f);
  };

  const enviar = async () => {
    if (!arquivo) {
      setErroUpload("Selecione um arquivo.");
      return;
    }
    setEnviando(true);
    setErroUpload(null);
    try {
      const fd = new FormData();
      fd.set("file", arquivo);
      fd.set("pacienteId", pacienteId);
      fd.set("categoria", categoria);
      if (descricao.trim()) fd.set("descricao", descricao.trim());
      const resp = await fetch("/api/documentos/upload", {
        method: "POST",
        body: fd,
      });
      const json = (await resp.json()) as
        | { ok: true; documento: DocumentoPaciente }
        | { ok: false; error: string };
      if (!json.ok) {
        setErroUpload(json.error);
        setEnviando(false);
        return;
      }
      fecharUpload(false);
      await carregar();
    } catch (e) {
      setErroUpload(e instanceof Error ? e.message : "Falha no upload.");
      setEnviando(false);
    }
  };

  const handleVisualizar = async (doc: DocumentoPaciente) => {
    const r = await getUrlDocumento(doc.id);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    if (isImagem(doc.tipo_arquivo)) {
      setLightbox({ url: r.url, nome: doc.nome_arquivo });
    } else {
      window.open(r.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleConfirmarExclusao = (doc: DocumentoPaciente) => {
    setConfirmarExclusao(doc);
  };

  const handleExcluir = () => {
    const doc = confirmarExclusao;
    if (!doc) return;
    startExcluir(async () => {
      const r = await excluirDocumento(doc.id);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setConfirmarExclusao(null);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      setThumbs((prev) => {
        const novo = { ...prev };
        delete novo[doc.id];
        return novo;
      });
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleArquivo(f);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-500">
          {docs.length === 0
            ? "Nenhum documento"
            : `${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`}
        </p>
        <button
          type="button"
          onClick={abrirUpload}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-dark transition-colors"
        >
          <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
          Adicionar documento
        </button>
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      {loading ? (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="aspect-square rounded-lg border border-slate-200 bg-slate-100 animate-pulse"
            />
          ))}
        </ul>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Nenhum documento. Adicione fotos, exames ou laudos.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {docs.map((doc) => {
            const imagem = isImagem(doc.tipo_arquivo);
            const thumb = thumbs[doc.id];
            return (
              <li
                key={doc.id}
                className="rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => handleVisualizar(doc)}
                  className="aspect-square w-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`Visualizar ${doc.nome_arquivo}`}
                >
                  {imagem && thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={doc.nome_arquivo}
                      className="h-full w-full object-cover"
                    />
                  ) : imagem ? (
                    <ImageIcon
                      size={32}
                      strokeWidth={1.5}
                      className="text-slate-300"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileText
                      size={36}
                      strokeWidth={1.5}
                      className="text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <div className="flex-1 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-medium leading-none",
                        CATEGORIA_BADGE[doc.categoria],
                      )}
                    >
                      {CATEGORIA_LABEL[doc.categoria]}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatTamanho(doc.tamanho_bytes)}
                    </span>
                  </div>
                  <p
                    className="text-xs font-medium text-slate-700 truncate"
                    title={doc.nome_arquivo}
                  >
                    {doc.nome_arquivo}
                  </p>
                  {doc.descricao ? (
                    <p
                      className="text-xs text-slate-500 line-clamp-2"
                      title={doc.descricao}
                    >
                      {doc.descricao}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-slate-500">
                    {format(new Date(doc.created_at), "dd MMM yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                  <div className="flex items-center justify-end gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleVisualizar(doc)}
                      aria-label="Visualizar documento"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <ExternalLink
                        size={14}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmarExclusao(doc)}
                      aria-label="Excluir documento"
                      className="rounded p-1.5 text-danger hover:bg-danger-surface transition-colors"
                    >
                      <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal de upload */}
      <Dialog.Root open={modalUploadAberto} onOpenChange={fecharUpload}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className={cn(
              "fixed z-50 bg-white shadow-lg focus:outline-none",
              "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
              "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
            )}
          >
            <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Adicionar documento
              </Dialog.Title>
              <Dialog.Close
                aria-label="Fechar"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} strokeWidth={1.5} />
              </Dialog.Close>
            </div>

            <div className="mt-4 space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                className={cn(
                  "rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                  dragOver
                    ? "border-primary bg-primary-surface/40"
                    : "border-slate-300 bg-slate-50 hover:bg-slate-100",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={TIPOS_ACEITOS}
                  className="hidden"
                  onChange={(e) => handleArquivo(e.target.files?.[0] ?? null)}
                />
                <Upload
                  size={28}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="mx-auto mb-2 text-slate-500"
                />
                {arquivo ? (
                  <>
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {arquivo.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatTamanho(arquivo.size)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-700">
                      Arraste aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-slate-500">
                      JPG, PNG, WebP, HEIC ou PDF (max 10MB)
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[14px] font-medium text-slate-900">
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) =>
                    setCategoria(e.target.value as CategoriaDocumento)
                  }
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[14px] font-medium text-slate-900">
                  Descricao (opcional)
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Ex: Hemograma de 03/2026"
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 resize-none"
                />
              </div>

              {erroUpload ? (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {erroUpload}
                </p>
              ) : null}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => fecharUpload(false)}
                  disabled={enviando}
                  className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={enviando || !arquivo}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  {enviando ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Confirmacao de exclusao */}
      <Dialog.Root
        open={confirmarExclusao !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmarExclusao(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className={cn(
              "fixed z-50 bg-white shadow-lg focus:outline-none",
              "inset-x-0 bottom-0 rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
              "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[400px] md:max-w-[calc(100vw-32px)] md:rounded-2xl md:p-6",
            )}
          >
            <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Excluir documento
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm text-slate-600">
              Deseja excluir{" "}
              <span className="font-medium text-slate-900">
                {confirmarExclusao?.nome_arquivo}
              </span>
              ? Esta acao nao pode ser desfeita.
            </Dialog.Description>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarExclusao(null)}
                disabled={isPendingExcluir}
                className="rounded px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExcluir}
                disabled={isPendingExcluir}
                className="rounded border border-danger bg-transparent px-4 py-2 text-sm font-medium text-danger hover:bg-danger-surface transition-colors disabled:opacity-50"
              >
                {isPendingExcluir ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Lightbox para imagens */}
      <Dialog.Root
        open={lightbox !== null}
        onOpenChange={(next) => {
          if (!next) setLightbox(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none">
            <Dialog.Title className="sr-only">
              {lightbox?.nome ?? "Imagem"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="absolute top-3 right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} strokeWidth={1.5} />
            </Dialog.Close>
            {lightbox ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt={lightbox.nome}
                className="max-h-[92vh] max-w-[92vw] object-contain"
              />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default TabDocumentos;
