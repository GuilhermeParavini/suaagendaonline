"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Edit3,
  Loader2,
  Mic,
  RefreshCw,
  Square,
  Upload,
  X,
} from "lucide-react";
import {
  criarAnamnese,
  uploadFotoAnamnese,
  type CampoTemplate,
  type Template,
} from "@/actions/anamnese";
import { uploadAudioEvolucao } from "@/actions/evolucoes";
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

type Modo = "manual" | "audio";

type AudioEstado = "idle" | "gravando" | "processando" | "pronto" | "erro";

const LIMITE_SEGUNDOS = 300;

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

function escolherMime(): string {
  const candidatos = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidatos) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(m)
    ) {
      return m;
    }
  }
  return "audio/webm";
}

function formatarTempo(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function FormNovaAnamnese({
  open,
  onOpenChange,
  pacienteId,
  templates,
  onSaved,
}: FormNovaAnamneseProps) {
  const ativos = templates.filter((t) => t.ativo);
  const [templateId, setTemplateId] = useState<string>(ativos[0]?.id ?? "");
  const templateAtual = ativos.find((t) => t.id === templateId) ?? null;

  const [modo, setModo] = useState<Modo>("manual");
  const [valores, setValores] = useState<Valores>(() => {
    const init: Valores = {};
    for (const c of camposOrdenados(templateAtual)) {
      init[c.id] = valorInicial(c);
    }
    return init;
  });
  const [camposPreenchidosIa, setCamposPreenchidosIa] = useState<Set<string>>(
    new Set(),
  );
  const [transcricao, setTranscricao] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioEstado, setAudioEstado] = useState<AudioEstado>("idle");
  const [audioErro, setAudioErro] = useState<string | null>(null);
  const [audioAviso, setAudioAviso] = useState<string | null>(null);
  const [tempo, setTempo] = useState(0);
  const [showFormulario, setShowFormulario] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [erroCampo, setErroCampo] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limiteRef = useRef(false);
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

  const handleTrocarTemplate = (novoId: string) => {
    setTemplateId(novoId);
    const novo = ativos.find((t) => t.id === novoId) ?? null;
    const init: Valores = {};
    for (const c of camposOrdenados(novo)) {
      init[c.id] = valorInicial(c);
    }
    setValores(init);
    setCamposPreenchidosIa(new Set());
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
    setCamposPreenchidosIa((prev) => {
      if (!prev.has(id)) return prev;
      const novo = new Set(prev);
      novo.delete(id);
      return novo;
    });
  };

  const toggleOpcao = (id: string, opcao: string) => {
    setValores((prev) => {
      const atual = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const ja = atual.includes(opcao);
      return {
        ...prev,
        [id]: ja ? atual.filter((o) => o !== opcao) : [...atual, opcao],
      };
    });
    setCamposPreenchidosIa((prev) => {
      if (!prev.has(id)) return prev;
      const novo = new Set(prev);
      novo.delete(id);
      return novo;
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

  const iniciarGravacao = async () => {
    setAudioErro(null);
    setAudioAviso(null);
    chunksRef.current = [];
    limiteRef.current = false;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setAudioErro("Microfone não disponível neste navegador.");
      setAudioEstado("erro");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setAudioErro(
        e instanceof Error
          ? `Permissão de microfone negada: ${e.message}`
          : "Permissão de microfone negada.",
      );
      setAudioEstado("erro");
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
        setAudioErro(
          e instanceof Error
            ? `Falha ao iniciar: ${e.message}`
            : "Falha ao iniciar gravação.",
        );
        setAudioEstado("erro");
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
    setAudioEstado("gravando");
    setTempo(0);
    intervalRef.current = setInterval(() => {
      setTempo((t) => {
        const novo = t + 1;
        if (novo >= LIMITE_SEGUNDOS && !limiteRef.current) {
          limiteRef.current = true;
          setAudioAviso("Limite de gravação atingido (5 min).");
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
    if (!templateAtual) return;
    setAudioEstado("processando");
    setAudioErro(null);

    const ext = tipo.includes("webm")
      ? "webm"
      : tipo.includes("mp4")
        ? "mp4"
        : tipo.includes("ogg")
          ? "ogg"
          : "webm";
    const fileName = `anamnese-audio-${Date.now()}.${ext}`;
    const file = new File([blob], fileName, { type: tipo });

    // Upload
    const fdUpload = new FormData();
    fdUpload.set("arquivo", file);
    fdUpload.set("pacienteId", pacienteId);
    const upResult = await uploadAudioEvolucao(fdUpload);
    if (!upResult.ok) {
      setAudioErro(upResult.error);
      setAudioEstado("erro");
      return;
    }
    setAudioUrl(upResult.data.url);

    // Transcricao + extracao
    const camposPayload = camposOrdenados(templateAtual).map((c) => ({
      id: c.id,
      label: c.label,
      tipo: c.tipo,
      ...(c.tipo === "selecao_multipla" ? { opcoes: c.opcoes ?? [] } : {}),
      ...(c.tipo === "escala_numerica"
        ? { min: c.min ?? 0, max: c.max ?? 10 }
        : {}),
    }));
    const fdAi = new FormData();
    fdAi.set("audio", file);
    fdAi.set("campos", JSON.stringify(camposPayload));
    fdAi.set(
      "duracaoSegundos",
      String(duracaoFinalRef.current || tempo || 0),
    );

    let resp: Response;
    try {
      resp = await fetch("/api/anamnese-audio", {
        method: "POST",
        body: fdAi,
      });
    } catch (e) {
      setAudioErro(
        e instanceof Error ? `Falha de rede: ${e.message}` : "Falha de rede.",
      );
      setAudioEstado("erro");
      return;
    }

    let json: {
      transcricao?: string;
      campos?: Record<string, unknown>;
      erro?: string;
    };
    try {
      json = await resp.json();
    } catch {
      setAudioErro("Resposta inválida do servidor.");
      setAudioEstado("erro");
      return;
    }

    if (!resp.ok) {
      setAudioErro(
        json.erro ??
          "Não foi possível transcrever. Tente novamente ou preencha manualmente.",
      );
      setAudioEstado("erro");
      return;
    }

    const transc = (json.transcricao ?? "").trim();
    const camposIa = (json.campos ?? {}) as Record<string, unknown>;

    const novosValores: Valores = {};
    const idsPreenchidos = new Set<string>();
    for (const c of camposOrdenados(templateAtual)) {
      const v = camposIa[c.id];
      if (v === undefined || v === null) {
        novosValores[c.id] = valorInicial(c);
        continue;
      }
      switch (c.tipo) {
        case "texto_livre": {
          const s = typeof v === "string" ? v : String(v);
          if (s.trim().length > 0) {
            novosValores[c.id] = s;
            idsPreenchidos.add(c.id);
          } else {
            novosValores[c.id] = "";
          }
          break;
        }
        case "sim_nao": {
          if (typeof v === "boolean") {
            novosValores[c.id] = v;
            idsPreenchidos.add(c.id);
          } else {
            novosValores[c.id] = null;
          }
          break;
        }
        case "selecao_multipla": {
          if (Array.isArray(v) && v.length > 0) {
            novosValores[c.id] = v.map((x) => String(x));
            idsPreenchidos.add(c.id);
          } else {
            novosValores[c.id] = [];
          }
          break;
        }
        case "escala_numerica": {
          if (typeof v === "number") {
            novosValores[c.id] = v;
            idsPreenchidos.add(c.id);
          } else {
            novosValores[c.id] = valorInicial(c);
          }
          break;
        }
        case "data": {
          const s = typeof v === "string" ? v : "";
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            novosValores[c.id] = s;
            idsPreenchidos.add(c.id);
          } else {
            novosValores[c.id] = "";
          }
          break;
        }
        default:
          novosValores[c.id] = valorInicial(c);
      }
    }

    setValores(novosValores);
    setCamposPreenchidosIa(idsPreenchidos);
    setTranscricao(transc);
    setAudioEstado("pronto");
    setShowFormulario(true);
  };

  const handleRegravar = () => {
    setAudioEstado("idle");
    setTempo(0);
    setAudioErro(null);
    setAudioAviso(null);
    setShowFormulario(false);
    setTranscricao("");
    liberarBlobUrl();
    setAudioBlobUrl(null);
    setAudioUrl(null);
    setCamposPreenchidosIa(new Set());
    if (templateAtual) {
      const init: Valores = {};
      for (const c of camposOrdenados(templateAtual)) {
        init[c.id] = valorInicial(c);
      }
      setValores(init);
    }
  };

  const trocarModo = (novo: Modo) => {
    setModo(novo);
    setErro(null);
    setErroCampo({});
    if (novo === "manual" && audioEstado !== "idle") {
      setShowFormulario(true);
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
        audioUrl: audioUrl ?? null,
      });
      if (!result.ok) {
        setErro(result.error);
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  };

  const camposLista = camposOrdenados(templateAtual);
  const mostrarFormulario =
    modo === "manual" || (modo === "audio" && showFormulario);

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

              {/* Mode toggle */}
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => trocarModo("manual")}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors",
                    modo === "manual"
                      ? "bg-primary text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:text-slate-900",
                  )}
                >
                  <Edit3 size={14} strokeWidth={1.5} aria-hidden="true" />
                  Preencher manualmente
                </button>
                <button
                  type="button"
                  onClick={() => trocarModo("audio")}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded px-3 py-2 text-sm font-medium transition-colors",
                    modo === "audio"
                      ? "bg-primary text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:text-slate-900",
                  )}
                >
                  <Mic size={14} strokeWidth={1.5} aria-hidden="true" />
                  Preencher por áudio
                </button>
              </div>

              <div className="mt-4 space-y-4 overflow-y-auto pb-2">
                {modo === "audio" && !showFormulario ? (
                  <>
                    <p className="rounded border border-primary/30 bg-primary-surface px-3 py-2 text-xs text-primary-dark">
                      Fale sobre cada item da lista. A IA vai identificar e
                      preencher os campos automaticamente.
                    </p>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[13px] font-medium text-slate-700 mb-2">
                        Itens deste template
                      </p>
                      <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">
                        {camposLista.map((c) => (
                          <li key={c.id}>{c.label}</li>
                        ))}
                      </ul>
                    </div>

                    {audioEstado === "idle" || audioEstado === "erro" ? (
                      <button
                        type="button"
                        onClick={iniciarGravacao}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#EA580C] transition-colors"
                      >
                        <Mic size={16} strokeWidth={1.5} aria-hidden="true" />
                        {audioEstado === "erro" ? "Tentar novamente" : "Gravar"}
                      </button>
                    ) : null}

                    {audioEstado === "gravando" ? (
                      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <button
                          type="button"
                          onClick={pararGravacao}
                          aria-label="Parar gravação"
                          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EF4444] text-white animate-pulse hover:bg-[#DC2626] transition-colors"
                        >
                          <Square
                            size={18}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </button>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-800">
                            Gravando...
                          </p>
                          <p className="text-xs text-red-600">
                            {formatarTempo(tempo)} /{" "}
                            {formatarTempo(LIMITE_SEGUNDOS)}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {audioEstado === "processando" ? (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        <Loader2
                          size={16}
                          strokeWidth={1.5}
                          className="animate-spin text-primary"
                          aria-hidden="true"
                        />
                        Processando áudio...
                      </div>
                    ) : null}

                    {audioAviso ? (
                      <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {audioAviso}
                      </p>
                    ) : null}
                    {audioErro ? (
                      <div className="space-y-2">
                        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {audioErro}
                        </p>
                        <button
                          type="button"
                          onClick={() => trocarModo("manual")}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Preencher manualmente
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {mostrarFormulario ? (
                  <>
                    {audioBlobUrl || audioUrl ? (
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-slate-700">
                            Áudio gravado
                          </p>
                          <button
                            type="button"
                            onClick={handleRegravar}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary-surface transition-colors"
                          >
                            <RefreshCw
                              size={12}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                            Regravar
                          </button>
                        </div>
                        <audio
                          controls
                          src={audioBlobUrl ?? audioUrl ?? undefined}
                          className="w-full"
                          preload="metadata"
                        />
                        {transcricao ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-slate-500">
                              Ver transcrição
                            </summary>
                            <p className="mt-1 whitespace-pre-wrap text-slate-600">
                              {transcricao}
                            </p>
                          </details>
                        ) : null}
                      </div>
                    ) : null}

                    {modo === "audio" && camposPreenchidosIa.size === 0 ? (
                      <div className="space-y-2">
                        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          A IA não conseguiu preencher campos automaticamente.
                          Preencha manualmente abaixo. A transcrição completa
                          está disponível como referência.
                        </p>
                        {transcricao ? (
                          <textarea
                            readOnly
                            rows={4}
                            value={transcricao}
                            className={cn(inputClass, "resize-y")}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {camposLista.map((c) => (
                      <CampoRender
                        key={c.id}
                        campo={c}
                        valor={valores[c.id]}
                        erro={erroCampo[c.id]}
                        uploading={Boolean(uploading[c.id])}
                        preenchidoPorIa={camposPreenchidosIa.has(c.id)}
                        onChange={(v) => setValor(c.id, v)}
                        onToggleOpcao={(o) => toggleOpcao(c.id, o)}
                        onUpload={(e) => handleUpload(c.id, e)}
                      />
                    ))}
                  </>
                ) : null}
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
                {mostrarFormulario ? (
                  <button
                    type="button"
                    onClick={handleSalvar}
                    disabled={isPending}
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    {isPending ? "Salvando..." : "Salvar anamnese"}
                  </button>
                ) : null}
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
  preenchidoPorIa: boolean;
  onChange: (valor: Valores[string]) => void;
  onToggleOpcao: (opcao: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function CampoRender({
  campo,
  valor,
  erro,
  uploading,
  preenchidoPorIa,
  onChange,
  onToggleOpcao,
  onUpload,
}: CampoRenderProps) {
  const inputClassIa = cn(
    inputClass,
    preenchidoPorIa && "bg-primary-surface border-primary/30",
  );
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
        <span>
          {campo.label}
          {campo.obrigatorio ? (
            <span className="ml-0.5 text-red-500">*</span>
          ) : null}
        </span>
        {preenchidoPorIa ? (
          <span className="inline-flex items-center rounded-full bg-primary-surface px-2 py-0.5 text-[10px] font-medium text-primary-dark">
            IA
          </span>
        ) : null}
      </label>

      {campo.tipo === "texto_livre" ? (
        <textarea
          rows={3}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClassIa, "resize-y")}
        />
      ) : null}

      {campo.tipo === "selecao_multipla" ? (
        <div className="space-y-1.5">
          {(campo.opcoes ?? []).map((opt) => {
            const checked = Array.isArray(valor) && valor.includes(opt);
            return (
              <label
                key={opt}
                className={cn(
                  "flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50",
                  preenchidoPorIa && "border-primary/30 bg-primary-surface/40",
                )}
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
        <div
          className={cn(
            "inline-flex rounded-lg border border-slate-200 bg-white p-1",
            preenchidoPorIa && "border-primary/30 bg-primary-surface",
          )}
        >
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
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-1",
                  preenchidoPorIa && "bg-primary-surface",
                )}
              >
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
          className={inputClassIa}
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
