"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, RefreshCw } from "lucide-react";
import { uploadAudioEvolucao } from "@/actions/evolucoes";
import { cn } from "@/lib/utils";

type Estado = "idle" | "gravando" | "processando" | "concluido";

interface GravadorAudioProps {
  pacienteId: string;
  onUsarTranscricao: (texto: string) => void;
  onAudioPronto?: (info: { url: string; transcricao: string }) => void;
}

const LIMITE_SEGUNDOS = 300;

function formatarTempo(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function GravadorAudio({
  pacienteId,
  onUsarTranscricao,
  onAudioPronto,
}: GravadorAudioProps) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [tempo, setTempo] = useState(0);
  const [transcricao, setTranscricao] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limiteAtingidoRef = useRef(false);
  const duracaoFinalRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);

  const limparTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const liberarStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const liberarBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      limparTimer();
      liberarStream();
      liberarBlobUrl();
    };
  }, []);

  const escolherMime = (): string => {
    const candidatos = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const m of candidatos) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
        return m;
      }
    }
    return "audio/webm";
  };

  const iniciarGravacao = async () => {
    setErro(null);
    setAviso(null);
    setTranscricao("");
    setAudioUrl(null);
    liberarBlobUrl();
    setAudioBlobUrl(null);
    chunksRef.current = [];
    limiteAtingidoRef.current = false;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErro("Microfone não suportado neste navegador.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setErro(
        e instanceof Error
          ? `Permissão de microfone negada: ${e.message}`
          : "Permissão de microfone negada.",
      );
      return;
    }

    const mime = escolherMime();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch (e) {
        liberarStream();
        setErro(
          e instanceof Error
            ? `Falha ao iniciar: ${e.message}`
            : "Falha ao iniciar gravação.",
        );
        return;
      }
    }

    streamRef.current = stream;
    recorderRef.current = recorder;

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = async () => {
      limparTimer();
      liberarStream();
      const tipo = recorder.mimeType || mime || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: tipo });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setAudioBlobUrl(url);
      await processarAudio(blob, tipo);
    };

    recorder.start(250);
    setEstado("gravando");
    setTempo(0);
    intervalRef.current = setInterval(() => {
      setTempo((t) => {
        const novo = t + 1;
        if (novo >= LIMITE_SEGUNDOS && !limiteAtingidoRef.current) {
          limiteAtingidoRef.current = true;
          setAviso("Limite de gravação atingido (5 min).");
          pararGravacao();
        }
        return Math.min(novo, LIMITE_SEGUNDOS);
      });
    }, 1000);
  };

  const pararGravacao = () => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      duracaoFinalRef.current = tempo;
      r.stop();
    }
  };

  const processarAudio = async (blob: Blob, tipo: string) => {
    setEstado("processando");
    setErro(null);

    const ext =
      tipo.includes("webm")
        ? "webm"
        : tipo.includes("mp4")
          ? "mp4"
          : tipo.includes("ogg")
            ? "ogg"
            : "webm";
    const fileName = `evolucao-${Date.now()}.${ext}`;
    const file = new File([blob], fileName, { type: tipo });

    // Upload
    const fdUpload = new FormData();
    fdUpload.set("arquivo", file);
    fdUpload.set("pacienteId", pacienteId);
    const upResult = await uploadAudioEvolucao(fdUpload);
    if (!upResult.ok) {
      setErro(upResult.error);
      setEstado("idle");
      return;
    }
    setAudioUrl(upResult.data.url);

    // Transcricao
    const fdTrans = new FormData();
    fdTrans.set("audio", file);
    fdTrans.set("duracaoSegundos", String(duracaoFinalRef.current || tempo));

    let textoTranscrito = "";
    try {
      const resp = await fetch("/api/transcricao", {
        method: "POST",
        body: fdTrans,
      });
      if (!resp.ok) {
        const dados = (await resp.json().catch(() => ({}))) as {
          erro?: string;
        };
        setErro(dados.erro ?? "Falha na transcrição.");
      } else {
        const dados = (await resp.json()) as { texto?: string };
        textoTranscrito = (dados.texto ?? "").trim();
        setTranscricao(textoTranscrito);
      }
    } catch (e) {
      setErro(
        e instanceof Error
          ? `Falha na transcrição: ${e.message}`
          : "Falha na transcrição.",
      );
    }

    setEstado("concluido");
    if (textoTranscrito && onAudioPronto) {
      onAudioPronto({ url: upResult.data.url, transcricao: textoTranscrito });
    }
  };

  const handleUsar = () => {
    if (transcricao.trim()) {
      onUsarTranscricao(transcricao.trim());
    }
  };

  const handleRegravar = () => {
    setTranscricao("");
    setAudioUrl(null);
    liberarBlobUrl();
    setAudioBlobUrl(null);
    setErro(null);
    setAviso(null);
    setEstado("idle");
    setTempo(0);
  };

  return (
    <div className="space-y-2">
      {estado === "idle" ? (
        <button
          type="button"
          onClick={iniciarGravacao}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#EA580C] transition-colors"
        >
          <Mic size={16} strokeWidth={1.5} aria-hidden="true" />
          Gravar áudio
        </button>
      ) : null}

      {estado === "gravando" ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <button
            type="button"
            onClick={pararGravacao}
            aria-label="Parar gravação"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444] text-white animate-pulse hover:bg-[#DC2626] transition-colors"
          >
            <Square size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Gravando...</p>
            <p className="text-xs text-red-600">
              {formatarTempo(tempo)} / {formatarTempo(LIMITE_SEGUNDOS)}
            </p>
          </div>
        </div>
      ) : null}

      {estado === "processando" ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <Loader2
            size={16}
            strokeWidth={1.5}
            className="animate-spin text-primary-text"
            aria-hidden="true"
          />
          Transcrevendo áudio...
        </div>
      ) : null}

      {estado === "concluido" ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-[14px] font-medium text-slate-900">
            Transcrição
          </label>
          <textarea
            value={transcricao}
            onChange={(e) => setTranscricao(e.target.value)}
            rows={4}
            placeholder="Texto transcrito..."
            className="w-full resize-y rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />

          {audioBlobUrl ? (
            <audio
              controls
              src={audioBlobUrl}
              className="w-full"
              preload="metadata"
            />
          ) : audioUrl ? (
            <audio
              controls
              src={audioUrl}
              className="w-full"
              preload="metadata"
            />
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleUsar}
              disabled={!transcricao.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Usar transcrição
            </button>
            <button
              type="button"
              onClick={handleRegravar}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary-text hover:bg-primary-surface transition-colors",
              )}
            >
              <RefreshCw size={13} strokeWidth={1.5} aria-hidden="true" />
              Regravar
            </button>
          </div>
        </div>
      ) : null}

      {aviso ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {aviso}
        </p>
      ) : null}
      {erro ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

export default GravadorAudio;
