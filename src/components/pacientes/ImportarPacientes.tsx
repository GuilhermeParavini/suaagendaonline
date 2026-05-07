"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  importarPacientesEmMassa,
  verificarCPFsExistentes,
} from "@/actions/importar-pacientes";
import {
  LIMITE_IMPORTACAO,
  type GeneroImport,
  type ImportacaoErroLinha,
  type PacienteImportacaoEntrada,
} from "@/lib/importar-pacientes-shared";
import { cleanCPF, cleanPhone, formatPhone } from "@/lib/masks";
import { isValidBirthDate, validateCPF } from "@/lib/validators";
import { cn } from "@/lib/utils";

type Etapa = "upload" | "mapeamento" | "preview";

type CampoSistema =
  | "nome"
  | "telefone"
  | "email"
  | "cpf"
  | "data_nascimento"
  | "genero"
  | "convenio"
  | "observacoes";

type ColunaSelecionada = string | "";

const CAMPOS_LABEL: Record<CampoSistema, { label: string; obrig: boolean }> = {
  nome: { label: "Nome completo", obrig: true },
  telefone: { label: "Telefone", obrig: false },
  email: { label: "E-mail", obrig: false },
  cpf: { label: "CPF", obrig: false },
  data_nascimento: { label: "Data de nascimento", obrig: false },
  genero: { label: "Genero", obrig: false },
  convenio: { label: "Convenio", obrig: false },
  observacoes: { label: "Observacoes", obrig: false },
};

const AUTO_DETECT: Record<CampoSistema, RegExp[]> = {
  nome: [/^(nome|name|paciente|fullname)/i, /nome.completo/i],
  telefone: [/^(tel|telefone|celular|phone|cel|whats)/i],
  email: [/^(e[-_ ]?mail|email)$/i, /^email/i],
  cpf: [/^cpf/i, /documento/i],
  data_nascimento: [/(nasc|birth|data.*nasc|nascimento)/i],
  genero: [/^(gen|sexo|genero)/i],
  convenio: [/(conv|plano|insurance)/i],
  observacoes: [/(obs|observ|notas|notes)/i],
};

interface ImportarPacientesProps {
  /** Callback ao concluir importacao com sucesso. */
  onConcluido: (resumo: { importados: number; pulados: number }) => void;
  /** Triggers o componente — botao customizado. */
  trigger: React.ReactNode;
}

interface LinhaPreview {
  linha: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  genero: GeneroImport | null;
  convenio: string | null;
  observacoes: string | null;
  problemas: string[]; // erros (vermelho)
  avisos: string[]; // amarelos
  jaExiste: boolean;
}

function parseDataNascimento(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // BR dd/mm/yyyy
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Excel serial number
  if (/^\d+$/.test(v) && Number(v) > 25000) {
    const serial = Number(v);
    // Excel epoch (windows): 1899-12-30
    const epoch = Date.UTC(1899, 11, 30);
    const ms = epoch + serial * 86400000;
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return null;
}

function parseGenero(valor: string): GeneroImport | null {
  const v = valor.trim().toLowerCase();
  if (!v) return null;
  if (["m", "masc", "masculino", "homem", "male"].includes(v)) return "masculino";
  if (["f", "fem", "feminino", "mulher", "female"].includes(v)) return "feminino";
  return "prefiro_nao_informar";
}

function ImportarPacientes({ onConcluido, trigger }: ImportarPacientesProps) {
  const [open, setOpen] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [colunas, setColunas] = useState<string[]>([]);
  const [linhasRaw, setLinhasRaw] = useState<Record<string, string>[]>([]);
  const [mapeamento, setMapeamento] = useState<
    Record<CampoSistema, ColunaSelecionada>
  >({
    nome: "",
    telefone: "",
    email: "",
    cpf: "",
    data_nascimento: "",
    genero: "",
    convenio: "",
    observacoes: "",
  });
  const [pularExistentes, setPularExistentes] = useState(true);
  const [linhasPreview, setLinhasPreview] = useState<LinhaPreview[]>([]);
  const [isImportando, startImportacao] = useTransition();
  const [resumoFinal, setResumoFinal] = useState<{
    importados: number;
    pulados: number;
    erros: ImportacaoErroLinha[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setEtapa("upload");
    setArquivoNome(null);
    setErro(null);
    setColunas([]);
    setLinhasRaw([]);
    setMapeamento({
      nome: "",
      telefone: "",
      email: "",
      cpf: "",
      data_nascimento: "",
      genero: "",
      convenio: "",
      observacoes: "",
    });
    setPularExistentes(true);
    setLinhasPreview([]);
    setResumoFinal(null);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

  // ---------------- Etapa 1: upload ----------------

  const aplicarAutoDetect = useCallback(
    (cols: string[]) => {
      const novo: Record<CampoSistema, ColunaSelecionada> = { ...mapeamento };
      const usadas = new Set<string>();
      for (const campo of Object.keys(AUTO_DETECT) as CampoSistema[]) {
        for (const re of AUTO_DETECT[campo]) {
          const match = cols.find(
            (c) => !usadas.has(c) && re.test(c),
          );
          if (match) {
            novo[campo] = match;
            usadas.add(match);
            break;
          }
        }
      }
      setMapeamento(novo);
    },
    // mapeamento esta vazio nesse ponto; ok ignorar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const processarLinhasParseadas = (rows: Record<string, unknown>[]) => {
    if (rows.length === 0) {
      setErro("Arquivo vazio.");
      return;
    }
    if (rows.length > LIMITE_IMPORTACAO) {
      setErro(
        `Arquivo tem ${rows.length} linhas. Limite: ${LIMITE_IMPORTACAO}.`,
      );
      return;
    }
    const cols = Object.keys(rows[0]);
    setColunas(cols);
    const normalizadas: Record<string, string>[] = rows.map((r) => {
      const out: Record<string, string> = {};
      for (const k of cols) {
        const v = r[k];
        out[k] = v === null || v === undefined ? "" : String(v);
      }
      return out;
    });
    setLinhasRaw(normalizadas);
    aplicarAutoDetect(cols);
    setEtapa("mapeamento");
  };

  const handleArquivo = (file: File) => {
    setErro(null);
    setArquivoNome(file.name);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";

    if (ext === "csv") {
      // Parse CSV via PapaParse com auto-detect de delimitador e BOM
      const reader = new FileReader();
      reader.onload = () => {
        let texto = reader.result as string;
        if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
        const result = Papa.parse<Record<string, unknown>>(texto, {
          header: true,
          skipEmptyLines: "greedy",
          dynamicTyping: false,
        });
        if (result.errors.length > 0 && result.data.length === 0) {
          setErro("Falha ao ler CSV. Verifique o formato.");
          return;
        }
        processarLinhasParseadas(result.data);
      };
      reader.onerror = () => setErro("Falha ao ler arquivo.");
      reader.readAsText(file, "utf-8");
      return;
    }

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buf = reader.result as ArrayBuffer;
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: "",
            raw: false,
          });
          processarLinhasParseadas(json);
        } catch {
          setErro("Falha ao ler Excel.");
        }
      };
      reader.onerror = () => setErro("Falha ao ler arquivo.");
      reader.readAsArrayBuffer(file);
      return;
    }

    setErro("Formato nao suportado. Use CSV, XLSX ou XLS.");
  };

  const handleDropZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleArquivo(f);
  };

  const handleSelecionarArquivo = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const f = e.target.files?.[0];
    if (f) handleArquivo(f);
    e.target.value = "";
  };

  // ---------------- Etapa 2: mapeamento + preview ----------------

  const linhasMapeadas = useMemo<LinhaPreview[]>(() => {
    if (etapa === "upload" || linhasRaw.length === 0) return [];
    const colNome = mapeamento.nome;
    if (!colNome) return [];

    const out: LinhaPreview[] = [];
    for (let i = 0; i < linhasRaw.length; i++) {
      const r = linhasRaw[i];
      const linha = i + 2; // header = 1
      const nome = (r[colNome] ?? "").trim();

      const problemas: string[] = [];
      const avisos: string[] = [];

      if (nome.length < 2) problemas.push("Nome obrigatorio");

      let telefone: string | null = null;
      if (mapeamento.telefone) {
        const v = (r[mapeamento.telefone] ?? "").trim();
        if (v) {
          const tel = cleanPhone(v);
          if (tel.length !== 10 && tel.length !== 11) {
            avisos.push("Telefone invalido");
          } else {
            telefone = tel;
          }
        }
      }

      let email: string | null = null;
      if (mapeamento.email) {
        const v = (r[mapeamento.email] ?? "").trim().toLowerCase();
        if (v) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
            avisos.push("E-mail invalido");
          } else {
            email = v;
          }
        }
      }

      let cpf: string | null = null;
      if (mapeamento.cpf) {
        const v = (r[mapeamento.cpf] ?? "").trim();
        if (v) {
          const c = cleanCPF(v);
          if (c.length !== 11 || !validateCPF(c)) {
            avisos.push("CPF invalido");
          } else {
            cpf = c;
          }
        }
      }

      let dataNasc: string | null = null;
      if (mapeamento.data_nascimento) {
        const v = (r[mapeamento.data_nascimento] ?? "").trim();
        if (v) {
          const iso = parseDataNascimento(v);
          if (!iso || !isValidBirthDate(iso)) {
            avisos.push("Data nasc. invalida");
          } else {
            dataNasc = iso;
          }
        }
      }

      const genero = mapeamento.genero
        ? parseGenero(r[mapeamento.genero] ?? "")
        : null;
      const convenio = mapeamento.convenio
        ? (r[mapeamento.convenio] ?? "").trim() || null
        : null;
      const observacoes = mapeamento.observacoes
        ? (r[mapeamento.observacoes] ?? "").trim() || null
        : null;

      out.push({
        linha,
        nome,
        telefone,
        email,
        cpf,
        data_nascimento: dataNasc,
        genero,
        convenio,
        observacoes,
        problemas,
        avisos,
        jaExiste: false,
      });
    }
    return out;
  }, [etapa, linhasRaw, mapeamento]);

  // Verifica CPFs existentes no servidor quando entra na etapa preview
  useEffect(() => {
    if (etapa !== "preview" || linhasMapeadas.length === 0) return;
    const cpfs = Array.from(
      new Set(
        linhasMapeadas
          .map((l) => l.cpf)
          .filter((c): c is string => Boolean(c)),
      ),
    );
    if (cpfs.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinhasPreview(linhasMapeadas);
      return;
    }
    let cancelado = false;
    (async () => {
      const r = await verificarCPFsExistentes(cpfs);
      if (cancelado) return;
      const existentes = r.ok ? new Set(r.existentes) : new Set<string>();
      const enriquecidas = linhasMapeadas.map((l) => ({
        ...l,
        jaExiste: l.cpf ? existentes.has(l.cpf) : false,
      }));
      setLinhasPreview(enriquecidas);
    })();
    return () => {
      cancelado = true;
    };
  }, [etapa, linhasMapeadas]);

  const podeAvancarMapeamento = mapeamento.nome.length > 0;

  const contadores = useMemo(() => {
    const list = etapa === "preview" ? linhasPreview : linhasMapeadas;
    let comErro = 0;
    let jaExistentes = 0;
    let novosValidos = 0;
    for (const l of list) {
      if (l.problemas.length > 0) {
        comErro += 1;
        continue;
      }
      if (l.jaExiste) {
        jaExistentes += 1;
        continue;
      }
      novosValidos += 1;
    }
    return { comErro, jaExistentes, novosValidos };
  }, [etapa, linhasPreview, linhasMapeadas]);

  const handleConfirmarImportacao = () => {
    setErro(null);
    const candidatos = linhasPreview.filter((l) => {
      if (l.problemas.length > 0) return false;
      if (l.jaExiste && pularExistentes) return false;
      return true;
    });
    if (candidatos.length === 0) {
      setErro("Nenhum paciente valido para importar.");
      return;
    }
    const payload: PacienteImportacaoEntrada[] = candidatos.map((l) => ({
      linha: l.linha,
      nome: l.nome,
      telefone: l.telefone,
      email: l.email,
      cpf: l.cpf,
      data_nascimento: l.data_nascimento,
      genero: l.genero,
      convenio: l.convenio,
      observacoes: l.observacoes,
    }));

    startImportacao(async () => {
      const r = await importarPacientesEmMassa(payload, pularExistentes);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setResumoFinal({
        importados: r.importados,
        pulados: r.pulados,
        erros: r.erros,
      });
    });
  };

  const handleFechar = () => {
    if (resumoFinal) {
      onConcluido({
        importados: resumoFinal.importados,
        pulados: resumoFinal.pulados,
      });
    }
    handleOpenChange(false);
  };

  // ---------------- Render ----------------

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[720px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
          )}
        >
          <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />

          <div className="flex items-start justify-between gap-3 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Importar pacientes
              </Dialog.Title>
              <Dialog.Description className="text-xs text-slate-500">
                {etapa === "upload"
                  ? "Etapa 1 de 3 — Selecione um arquivo CSV ou Excel."
                  : etapa === "mapeamento"
                    ? "Etapa 2 de 3 — Mapeie as colunas do arquivo."
                    : "Etapa 3 de 3 — Revise e confirme a importacao."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto">
            {erro ? (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            ) : null}

            {resumoFinal ? (
              <ResumoFinal
                resumo={resumoFinal}
                onFechar={handleFechar}
              />
            ) : etapa === "upload" ? (
              <EtapaUpload
                arquivoNome={arquivoNome}
                inputRef={inputRef}
                onArquivo={handleArquivo}
                onDrop={handleDropZone}
                onChange={handleSelecionarArquivo}
              />
            ) : etapa === "mapeamento" ? (
              <EtapaMapeamento
                colunas={colunas}
                mapeamento={mapeamento}
                onChange={setMapeamento}
                preview={linhasRaw.slice(0, 5)}
              />
            ) : (
              <EtapaPreview
                linhas={linhasPreview}
                pularExistentes={pularExistentes}
                onTogglePular={() => setPularExistentes((v) => !v)}
                contadores={contadores}
              />
            )}
          </div>

          {!resumoFinal ? (
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
              {etapa !== "upload" ? (
                <button
                  type="button"
                  onClick={() => {
                    setErro(null);
                    if (etapa === "preview") setEtapa("mapeamento");
                    else setEtapa("upload");
                  }}
                  disabled={isImportando}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
                  Voltar
                </button>
              ) : null}

              {etapa === "mapeamento" ? (
                <button
                  type="button"
                  onClick={() => setEtapa("preview")}
                  disabled={!podeAvancarMapeamento}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  Avancar
                </button>
              ) : null}

              {etapa === "preview" ? (
                <button
                  type="button"
                  onClick={handleConfirmarImportacao}
                  disabled={
                    isImportando ||
                    contadores.novosValidos === 0
                  }
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  {isImportando
                    ? "Importando..."
                    : `Importar ${contadores.novosValidos} ${contadores.novosValidos === 1 ? "paciente" : "pacientes"}`}
                </button>
              ) : null}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ============================================================
// Sub-componentes
// ============================================================

function EtapaUpload({
  arquivoNome,
  inputRef,
  onArquivo,
  onDrop,
  onChange,
}: {
  arquivoNome: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onArquivo: (f: File) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-10 text-center cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Upload
          size={28}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-slate-500"
        />
        <p className="text-sm font-medium text-slate-900">
          Arraste o arquivo aqui ou clique para selecionar
        </p>
        <p className="text-xs text-slate-500">
          Formatos: .csv, .xlsx, .xls (limite {LIMITE_IMPORTACAO} pacientes)
        </p>
        {arquivoNome ? (
          <p className="mt-2 inline-flex items-center gap-1 rounded bg-primary-surface px-2 py-1 text-[12px] font-medium text-primary-text">
            <FileSpreadsheet size={12} strokeWidth={1.5} aria-hidden="true" />
            {arquivoNome}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onChange}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-relaxed">
        <p className="font-medium text-slate-900">Dica</p>
        <p>
          O arquivo deve ter cabecalho na primeira linha. Aceita virgula ou
          ponto-e-virgula como separador. Datas podem estar em dd/mm/aaaa ou
          aaaa-mm-dd. Voce ira mapear as colunas no proximo passo.
        </p>
      </div>
    </div>
  );
}

function EtapaMapeamento({
  colunas,
  mapeamento,
  onChange,
  preview,
}: {
  colunas: string[];
  mapeamento: Record<CampoSistema, string>;
  onChange: (m: Record<CampoSistema, string>) => void;
  preview: Record<string, string>[];
}) {
  const setCampo = (campo: CampoSistema, valor: string) => {
    onChange({ ...mapeamento, [campo]: valor });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(CAMPOS_LABEL) as CampoSistema[]).map((campo) => {
          const meta = CAMPOS_LABEL[campo];
          return (
            <div key={campo} className="space-y-1">
              <label className="block text-[14px] font-medium text-slate-900">
                {meta.label}
                {meta.obrig ? (
                  <span className="ml-0.5 text-red-500">*</span>
                ) : null}
              </label>
              <select
                value={mapeamento[campo]}
                onChange={(e) => setCampo(campo, e.target.value)}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
              >
                <option value="">Nao mapear</option>
                {colunas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {preview.length > 0 ? (
        <div className="rounded-lg border border-slate-200">
          <p className="px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-slate-500 border-b border-slate-200">
            Pre-visualizacao das primeiras {preview.length} linhas
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {colunas.map((c) => (
                    <th
                      key={c}
                      className="px-2 py-1.5 font-medium text-slate-600"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.map((row, i) => (
                  <tr key={i} className="text-slate-700">
                    {colunas.map((c) => (
                      <td
                        key={c}
                        className="px-2 py-1.5 max-w-[160px] truncate"
                      >
                        {row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EtapaPreview({
  linhas,
  pularExistentes,
  onTogglePular,
  contadores,
}: {
  linhas: LinhaPreview[];
  pularExistentes: boolean;
  onTogglePular: () => void;
  contadores: { comErro: number; jaExistentes: number; novosValidos: number };
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Badge
          label="Novos"
          valor={contadores.novosValidos}
          cor="bg-[#D1FAE5] text-[#065F46]"
        />
        <Badge
          label="Ja existentes"
          valor={contadores.jaExistentes}
          cor="bg-amber-100 text-amber-800"
        />
        <Badge
          label="Com erro"
          valor={contadores.comErro}
          cor="bg-red-100 text-red-700"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={pularExistentes}
          onChange={onTogglePular}
          className="h-4 w-4 rounded border-slate-300 text-primary-text focus:ring-primary/40"
        />
        Pular pacientes ja existentes (CPF duplicado)
      </label>

      <div className="rounded-lg border border-slate-200 max-h-[360px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-2 py-1.5 font-medium text-slate-600">#</th>
              <th className="px-2 py-1.5 font-medium text-slate-600">Nome</th>
              <th className="px-2 py-1.5 font-medium text-slate-600">CPF</th>
              <th className="px-2 py-1.5 font-medium text-slate-600">
                Telefone
              </th>
              <th className="px-2 py-1.5 font-medium text-slate-600">E-mail</th>
              <th className="px-2 py-1.5 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => {
              const tem = l.problemas.length > 0;
              const aviso = !tem && (l.avisos.length > 0 || l.jaExiste);
              return (
                <tr
                  key={l.linha}
                  className={cn(
                    "text-slate-700",
                    tem && "bg-red-50/50",
                    aviso && "bg-amber-50/50",
                  )}
                >
                  <td className="px-2 py-1.5 text-slate-500">{l.linha}</td>
                  <td className="px-2 py-1.5 truncate max-w-[180px]">
                    {l.nome || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">
                    {l.cpf
                      ? `${l.cpf.slice(0, 3)}.***.${l.cpf.slice(-2)}`
                      : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">
                    {l.telefone ? formatPhone(l.telefone) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 truncate max-w-[180px]">
                    {l.email ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    {tem ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
                        <AlertTriangle
                          size={11}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {l.problemas[0]}
                      </span>
                    ) : l.jaExiste ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                        <AlertTriangle
                          size={11}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Ja cadastrado
                      </span>
                    ) : l.avisos.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                        <AlertTriangle
                          size={11}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {l.avisos[0]}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#065F46]">
                        <Check size={11} strokeWidth={2} aria-hidden="true" />
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResumoFinal({
  resumo,
  onFechar,
}: {
  resumo: { importados: number; pulados: number; erros: ImportacaoErroLinha[] };
  onFechar: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="sao-check-pop mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#D1FAE5]">
        <Check
          size={32}
          strokeWidth={2.5}
          aria-hidden="true"
          className="text-[#065F46]"
        />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">
          Importacao concluida
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {resumo.importados}{" "}
          {resumo.importados === 1 ? "paciente importado" : "pacientes importados"}
          {resumo.pulados > 0 ? `, ${resumo.pulados} pulados` : ""}
          {resumo.erros.length > 0
            ? `, ${resumo.erros.length} com erro`
            : ""}
          .
        </p>
      </div>

      {resumo.erros.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-left text-xs max-h-[200px] overflow-auto">
          <p className="px-3 py-2 font-medium text-red-700 border-b border-red-200">
            Linhas com erro
          </p>
          <ul className="divide-y divide-red-100">
            {resumo.erros.slice(0, 50).map((e, i) => (
              <li
                key={`${e.linha}-${i}`}
                className="px-3 py-1.5 text-red-700"
              >
                Linha {e.linha} ({e.nome || "sem nome"}): {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onFechar}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark transition-colors"
      >
        Fechar
      </button>
    </div>
  );
}

function Badge({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-center",
        cor,
      )}
    >
      <p className="text-[20px] font-semibold leading-tight">{valor}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
    </div>
  );
}

export default ImportarPacientes;
