"use client";

import { useState, useTransition, type RefObject } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Printer,
} from "lucide-react";
import {
  compartilharOuBaixarPng,
  nomeArquivoDocumento,
} from "@/lib/documento-imagem";

interface DocumentoAcoesProps {
  documentoRef: RefObject<HTMLElement | null>;
  prefixoArquivo: string;
  pacienteNome: string | null;
  pacienteEmail: string | null;
  dataReferencia: string; // dd/mm/aaaa
  assuntoEmail: string;
  mensagemBase: string;
  tituloShare: string;
}

function DocumentoAcoes({
  documentoRef,
  prefixoArquivo,
  pacienteNome,
  pacienteEmail,
  dataReferencia,
  assuntoEmail,
  mensagemBase,
  tituloShare,
}: DocumentoAcoesProps) {
  const [feedbackImagem, setFeedbackImagem] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState<string | null>(null);
  const [gerandoImagem, startGerar] = useTransition();

  const handleWhatsApp = () => {
    const texto = encodeURIComponent(mensagemBase);
    window.open(
      `https://wa.me/?text=${texto}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleEmail = () => {
    const assunto = encodeURIComponent(assuntoEmail);
    const corpo = encodeURIComponent(mensagemBase);
    const destino = pacienteEmail ?? "";
    window.location.href = `mailto:${destino}?subject=${assunto}&body=${corpo}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEnviarImagem = () => {
    setFeedbackImagem(null);
    setErroImagem(null);
    const el = documentoRef.current;
    if (!el) return;
    startGerar(async () => {
      const filename = nomeArquivoDocumento(
        prefixoArquivo,
        pacienteNome,
        dataReferencia,
      );
      const r = await compartilharOuBaixarPng(el, filename);
      if (!r.ok) {
        setErroImagem(r.error);
        return;
      }
      if (r.modo === "download") {
        setFeedbackImagem(
          "Imagem salva! Envie pelo WhatsApp manualmente.",
        );
      } else {
        setFeedbackImagem("Imagem compartilhada.");
      }
      window.setTimeout(() => setFeedbackImagem(null), 3500);
      void tituloShare;
    });
  };

  return (
    <div className="no-print mx-auto max-w-[680px] space-y-2 pt-2">
      <button
        type="button"
        onClick={handleWhatsApp}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-sm font-medium text-white hover:bg-[#1ebe5a] transition-colors active:scale-[0.99]"
      >
        <MessageCircle size={16} strokeWidth={1.5} aria-hidden="true" />
        Enviar por WhatsApp
      </button>

      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          ou
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={handleEnviarImagem}
        disabled={gerandoImagem}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-sm font-medium text-white hover:bg-[#1ebe5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.99]"
      >
        {gerandoImagem ? (
          <>
            <Loader2
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="animate-spin"
            />
            Gerando imagem...
          </>
        ) : (
          <>
            <ImageIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            Enviar imagem pelo WhatsApp
          </>
        )}
      </button>

      {feedbackImagem ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {feedbackImagem}
        </p>
      ) : null}
      {erroImagem ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erroImagem}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleEmail}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-5 py-3 text-sm font-medium text-primary hover:bg-primary-surface transition-colors active:scale-[0.99]"
      >
        <Mail size={16} strokeWidth={1.5} aria-hidden="true" />
        Enviar por e-mail
      </button>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Printer size={13} strokeWidth={1.5} aria-hidden="true" />
          Imprimir
        </button>
      </div>
    </div>
  );
}

export default DocumentoAcoes;
