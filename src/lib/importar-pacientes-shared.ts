// Tipos e constantes compartilhados entre o server action de importacao e o
// componente client. Mantido fora do arquivo `"use server"` porque server
// actions so permitem exports de funcoes async — qualquer const/sync export
// derruba o modulo inteiro em build.

export const LIMITE_IMPORTACAO = 500;

export type GeneroImport = "masculino" | "feminino" | "prefiro_nao_informar";

export interface PacienteImportacaoEntrada {
  /** Indice da linha no arquivo original (1-based, util para reportar erros). */
  linha: number;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cpf?: string | null;
  data_nascimento?: string | null; // ISO yyyy-mm-dd
  genero?: GeneroImport | null;
  convenio?: string | null;
  observacoes?: string | null;
}

export interface ImportacaoErroLinha {
  linha: number;
  nome: string;
  motivo: string;
}

export type ImportarPacientesResult =
  | {
      ok: true;
      importados: number;
      pulados: number;
      erros: ImportacaoErroLinha[];
    }
  | { ok: false; error: string };

export type VerificarCPFsResult =
  | { ok: true; existentes: string[] }
  | { ok: false; error: string };
