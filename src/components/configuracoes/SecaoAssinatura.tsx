"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Upload, X } from "lucide-react";
import { salvarAssinatura } from "@/actions/configuracoes";
import type { ProfissionalConfig } from "@/lib/configuracoes-types";
import {
  SIGNATURE_FONTS,
  signatureFontClass,
} from "@/lib/signature-fonts";
import { cn } from "@/lib/utils";

interface SecaoAssinaturaProps {
  profissional: ProfissionalConfig;
  onSaved: () => void;
}

const labelClass = "block text-[14px] font-medium text-slate-900";
const inputClass =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10";

const MAX_BYTES = 500 * 1024;
const TIPOS_VALIDOS = ["image/png", "image/jpeg", "image/jpg"];

function SecaoAssinatura({
  profissional,
  onSaved,
}: SecaoAssinaturaProps) {
  const [tipo, setTipo] = useState<"fonte" | "imagem">(
    profissional.assinatura_tipo ?? "fonte",
  );
  const [fonte, setFonte] = useState<string>(
    profissional.assinatura_fonte ?? SIGNATURE_FONTS[0].value,
  );
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    profissional.assinatura_url,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const trocarArquivo = (f: File | null) => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (f) {
      const url = URL.createObjectURL(f);
      blobUrlRef.current = url;
      setArquivo(f);
      setPreviewUrl(url);
    } else {
      setArquivo(null);
      setPreviewUrl(profissional.assinatura_url);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErro(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!TIPOS_VALIDOS.includes(f.type)) {
      setErro("Use PNG ou JPG.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_BYTES) {
      setErro("Imagem acima de 500KB.");
      e.target.value = "";
      return;
    }
    trocarArquivo(f);
  };

  const handleRemoverArquivo = () => {
    trocarArquivo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSalvar = () => {
    setErro(null);
    setOkMsg(false);

    const formData = new FormData();
    formData.set("tipo", tipo);

    if (tipo === "fonte") {
      formData.set("fonte", fonte);
    } else {
      if (arquivo) {
        formData.set("arquivo", arquivo);
      } else if (profissional.assinatura_url) {
        formData.set("usarExistente", "true");
      } else {
        setErro("Envie uma imagem de assinatura.");
        return;
      }
    }

    startTransition(async () => {
      const result = await salvarAssinatura(formData);
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      setArquivo(null);
      setOkMsg(true);
      window.setTimeout(() => setOkMsg(false), 2000);
      onSaved();
    });
  };

  const nomeProfissional = profissional.nome || "Seu nome";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">Assinatura</h2>
        <p className="text-xs text-slate-500">
          Aparece no rodapé dos recibos.
        </p>
      </header>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          Assinatura atualizada
        </p>
      ) : null}

      <div className="space-y-3">
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors",
            tipo === "fonte"
              ? "border-primary bg-primary-surface"
              : "border-slate-200 hover:border-slate-300",
          )}
        >
          <input
            type="radio"
            name="assinatura-tipo"
            value="fonte"
            checked={tipo === "fonte"}
            onChange={() => setTipo("fonte")}
            className="mt-0.5 h-4 w-4 border-slate-300 text-primary-text focus:ring-primary/40"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Gerar com meu nome
              </p>
              <p className="text-xs text-slate-500">
                Renderizada com fonte cursiva.
              </p>
            </div>

            {tipo === "fonte" ? (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Fonte</label>
                  <select
                    value={fonte}
                    onChange={(e) => setFonte(e.target.value)}
                    className={inputClass}
                  >
                    {SIGNATURE_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Pré-visualização
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-2xl text-slate-700 leading-tight",
                      signatureFontClass(fonte),
                    )}
                  >
                    {nomeProfissional}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </label>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors",
            tipo === "imagem"
              ? "border-primary bg-primary-surface"
              : "border-slate-200 hover:border-slate-300",
          )}
        >
          <input
            type="radio"
            name="assinatura-tipo"
            value="imagem"
            checked={tipo === "imagem"}
            onChange={() => setTipo("imagem")}
            className="mt-0.5 h-4 w-4 border-slate-300 text-primary-text focus:ring-primary/40"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Enviar imagem
              </p>
              <p className="text-xs text-slate-500">
                PNG ou JPG, até 500KB.
              </p>
            </div>

            {tipo === "imagem" ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                    id="assinatura-arquivo"
                  />
                  <label
                    htmlFor="assinatura-arquivo"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-primary px-3 py-1.5 text-xs font-medium text-primary-text hover:bg-primary-surface transition-colors"
                  >
                    <Upload size={13} strokeWidth={1.5} aria-hidden="true" />
                    Escolher arquivo
                  </label>
                  {arquivo ? (
                    <button
                      type="button"
                      onClick={handleRemoverArquivo}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <X size={13} strokeWidth={1.5} aria-hidden="true" />
                      Remover
                    </button>
                  ) : null}
                </div>

                {previewUrl ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Pré-visualização
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Pré-visualização da assinatura"
                      className="mx-auto mt-2 max-h-[80px] object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Nenhuma imagem enviada ainda.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </label>
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={isPending}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar assinatura"}
        </button>
      </div>
    </section>
  );
}

export default SecaoAssinatura;
