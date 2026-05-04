import { toBlob } from "html-to-image";

export type CompartilharResult =
  | { ok: true; modo: "share" | "download" }
  | { ok: false; error: string };

const SLUG_REGEX = /[^a-z0-9]+/g;

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(SLUG_REGEX, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function nomeArquivoRecibo(
  pacienteNome: string | null,
  dataBR: string,
): string {
  const nome = slugify(pacienteNome ?? "paciente") || "paciente";
  const dataSafe = dataBR.replace(/\//g, "-");
  return `recibo-${nome}-${dataSafe}.png`;
}

export async function gerarPngRecibo(
  element: HTMLElement,
): Promise<Blob | null> {
  const originalWidth = element.style.width;
  const originalShadow = element.style.boxShadow;
  element.style.width = "800px";
  element.style.boxShadow = "none";
  try {
    const blob = await toBlob(element, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    return blob;
  } finally {
    element.style.width = originalWidth;
    element.style.boxShadow = originalShadow;
  }
}

export async function compartilharOuBaixarPng(
  element: HTMLElement,
  filename: string,
): Promise<CompartilharResult> {
  let blob: Blob | null;
  try {
    blob = await gerarPngRecibo(element);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Falha ao gerar imagem: ${e.message}`
          : "Falha ao gerar imagem.",
    };
  }
  if (!blob) {
    return { ok: false, error: "Falha ao gerar imagem." };
  }

  const file = new File([blob], filename, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  const podeShareFile =
    typeof nav.share === "function" &&
    typeof nav.canShare === "function" &&
    nav.canShare({ files: [file] });

  if (podeShareFile) {
    try {
      await nav.share({ files: [file], title: "Recibo" });
      return { ok: true, modo: "share" };
    } catch (e) {
      // Usuario cancelou ou falhou; cai pro download
      if (e instanceof Error && e.name === "AbortError") {
        return { ok: true, modo: "share" };
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, modo: "download" };
}
