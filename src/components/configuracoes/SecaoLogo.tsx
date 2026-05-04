"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2, Upload } from "lucide-react";
import {
  removerLogo,
  salvarLogo,
  type ProfissionalConfig,
} from "@/actions/configuracoes";
import { cn } from "@/lib/utils";

interface SecaoLogoProps {
  profissional: ProfissionalConfig;
  onSaved: () => void;
}

const MAX_BYTES = 1 * 1024 * 1024;
const TIPOS_VALIDOS = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
];

function SecaoLogo({ profissional, onSaved }: SecaoLogoProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    profissional.logo_url,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
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

  const validar = (f: File): string | null => {
    if (!TIPOS_VALIDOS.includes(f.type)) return "Use PNG, JPG ou SVG.";
    if (f.size > MAX_BYTES) return "Imagem acima de 1MB.";
    return null;
  };

  const enviar = (f: File) => {
    setErro(null);
    setOkMsg(null);

    const v = validar(f);
    if (v) {
      setErro(v);
      return;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const localUrl = URL.createObjectURL(f);
    blobUrlRef.current = localUrl;
    setPreviewUrl(localUrl);

    const fd = new FormData();
    fd.set("arquivo", f);

    startTransition(async () => {
      const r = await salvarLogo(fd);
      if (!r.ok) {
        setErro(r.error);
        setPreviewUrl(profissional.logo_url);
        return;
      }
      setOkMsg("Logo atualizada");
      window.setTimeout(() => setOkMsg(null), 2500);
      // Atualiza para a URL final do storage
      setPreviewUrl(r.data.url);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      onSaved();
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) enviar(f);
  };

  const handleRemover = () => {
    setErro(null);
    setOkMsg(null);
    if (!confirm("Remover logo?")) return;
    startTransition(async () => {
      const r = await removerLogo();
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPreviewUrl(null);
      setOkMsg("Logo removida");
      window.setTimeout(() => setOkMsg(null), 2500);
      onSaved();
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files?.[0];
    if (f) enviar(f);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">
          Logo da clínica
        </h2>
        <p className="text-xs text-slate-500">
          Aparece no recibo, nas páginas públicas e no cabeçalho do seu
          painel.
        </p>
      </header>

      {okMsg ? (
        <p className="rounded border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-2 text-xs font-medium text-[#115E59]">
          {okMsg}
        </p>
      ) : null}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed transition-colors p-4 text-center",
          arrastando
            ? "border-primary bg-primary-surface"
            : "border-slate-200 bg-slate-50",
        )}
      >
        {previewUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Logo"
              className="mx-auto max-h-[80px] object-contain"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleRemover}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-1.5 rounded border border-danger bg-transparent px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-surface transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} strokeWidth={1.5} aria-hidden="true" />
                Remover logo
              </button>
              <label
                htmlFor="logo-arquivo"
                className={cn(
                  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border border-primary bg-transparent px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-surface transition-colors",
                  isPending && "opacity-50 cursor-not-allowed",
                )}
              >
                <Upload size={13} strokeWidth={1.5} aria-hidden="true" />
                Trocar
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload
              size={28}
              strokeWidth={1.5}
              className="mx-auto text-slate-400"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-600">
              Arraste uma imagem ou{" "}
              <label
                htmlFor="logo-arquivo"
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                clique para selecionar
              </label>
            </p>
            <p className="text-[11px] text-slate-400">
              PNG, JPG ou SVG, até 1MB
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          id="logo-arquivo"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleFileInput}
          disabled={isPending}
          className="hidden"
        />
      </div>

      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

export default SecaoLogo;
