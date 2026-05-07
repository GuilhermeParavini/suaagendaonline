"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cleanCPF, cleanPhone } from "@/lib/masks";
import { isValidBirthDate, validateCPF } from "@/lib/validators";
import {
  LIMITE_IMPORTACAO,
  type GeneroImport,
  type ImportacaoErroLinha,
  type ImportarPacientesResult,
  type PacienteImportacaoEntrada,
  type VerificarCPFsResult,
} from "@/lib/importar-pacientes-shared";

const LGPD_TEXT_IMPORT =
  "Termo de consentimento LGPD aceito pelo profissional ao importar paciente. " +
  "Autoriza tratamento de dados pessoais e sensiveis para finalidade clinica e administrativa, " +
  "conforme Lei 13.709/2018.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function genero(v: unknown): GeneroImport | null {
  if (v === "masculino" || v === "feminino" || v === "prefiro_nao_informar") {
    return v;
  }
  return null;
}

// ============================================================
// verificarCPFsExistentes — usado pelo client durante a etapa de preview
// ============================================================

export async function verificarCPFsExistentes(
  cpfs: string[],
): Promise<VerificarCPFsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const limpos = Array.from(
    new Set(
      cpfs
        .map((c) => cleanCPF(c ?? ""))
        .filter((c) => c.length === 11 && validateCPF(c)),
    ),
  );
  if (limpos.length === 0) return { ok: true, existentes: [] };

  const { data, error } = await admin
    .from("pacientes")
    .select("cpf")
    .eq("tenant_id", prof.tenant_id)
    .in("cpf", limpos);
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    existentes: Array.from(
      new Set(
        (data ?? [])
          .map((r) => (r.cpf as string | null) ?? "")
          .filter((c): c is string => c.length === 11),
      ),
    ),
  };
}

// ============================================================
// importarPacientesEmMassa
// ============================================================

export async function importarPacientesEmMassa(
  pacientes: PacienteImportacaoEntrada[],
  pularExistentes: boolean = true,
): Promise<ImportarPacientesResult> {
  if (!Array.isArray(pacientes) || pacientes.length === 0) {
    return { ok: false, error: "Nenhum paciente informado." };
  }
  if (pacientes.length > LIMITE_IMPORTACAO) {
    return {
      ok: false,
      error: `Limite de ${LIMITE_IMPORTACAO} pacientes por importacao.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessao expirada." };

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from("profissionais")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) return { ok: false, error: profErr.message };
  if (!prof) return { ok: false, error: "Profissional nao encontrado." };

  const tenantId = prof.tenant_id as string;

  // Valida cada linha e prepara payload
  const erros: ImportacaoErroLinha[] = [];
  type Preparado = {
    linha: number;
    nome: string;
    cpf: string | null;
    telefone: string | null;
    email: string | null;
    data_nascimento: string | null;
    genero: GeneroImport | null;
    convenio: string | null;
    observacoes: string | null;
  };
  const preparados: Preparado[] = [];

  for (const p of pacientes) {
    const linha = p.linha;
    const nome = (p.nome ?? "").trim();
    if (nome.length < 2) {
      erros.push({ linha, nome: nome || "(sem nome)", motivo: "Nome obrigatorio." });
      continue;
    }

    let cpf: string | null = null;
    if (p.cpf && p.cpf.trim()) {
      const limpo = cleanCPF(p.cpf);
      if (limpo.length !== 11 || !validateCPF(limpo)) {
        erros.push({ linha, nome, motivo: "CPF invalido." });
        continue;
      }
      cpf = limpo;
    }

    let telefone: string | null = null;
    if (p.telefone && p.telefone.trim()) {
      const tel = cleanPhone(p.telefone);
      if (tel.length !== 10 && tel.length !== 11) {
        erros.push({ linha, nome, motivo: "Telefone invalido." });
        continue;
      }
      telefone = tel;
    }

    let email: string | null = null;
    if (p.email && p.email.trim()) {
      const e = p.email.trim().toLowerCase();
      if (!EMAIL_RE.test(e)) {
        erros.push({ linha, nome, motivo: "E-mail invalido." });
        continue;
      }
      email = e;
    }

    let dataNasc: string | null = null;
    if (p.data_nascimento && p.data_nascimento.trim()) {
      const iso = p.data_nascimento.trim();
      if (!ISO_DATE_RE.test(iso) || !isValidBirthDate(iso)) {
        erros.push({ linha, nome, motivo: "Data de nascimento invalida." });
        continue;
      }
      dataNasc = iso;
    }

    preparados.push({
      linha,
      nome,
      cpf,
      telefone,
      email,
      data_nascimento: dataNasc,
      genero: genero(p.genero),
      convenio: p.convenio?.trim() || null,
      observacoes: p.observacoes?.trim() || null,
    });
  }

  // Verifica CPFs ja existentes
  const cpfsParaChecar = Array.from(
    new Set(
      preparados.map((p) => p.cpf).filter((c): c is string => c !== null),
    ),
  );
  let existentesSet = new Set<string>();
  if (cpfsParaChecar.length > 0) {
    const { data: existRows, error: existErr } = await admin
      .from("pacientes")
      .select("cpf")
      .eq("tenant_id", tenantId)
      .in("cpf", cpfsParaChecar);
    if (existErr) return { ok: false, error: existErr.message };
    existentesSet = new Set(
      (existRows ?? [])
        .map((r) => (r.cpf as string | null) ?? "")
        .filter((c): c is string => c.length === 11),
    );
  }

  // Filtra pacientes a inserir
  const pulados: Preparado[] = [];
  const inserir: Preparado[] = [];
  const cpfsNoLote = new Set<string>();
  for (const p of preparados) {
    if (p.cpf) {
      if (existentesSet.has(p.cpf)) {
        if (pularExistentes) {
          pulados.push(p);
          continue;
        }
        erros.push({
          linha: p.linha,
          nome: p.nome,
          motivo: "CPF ja cadastrado.",
        });
        continue;
      }
      // Evita duplicata dentro do proprio lote
      if (cpfsNoLote.has(p.cpf)) {
        pulados.push(p);
        continue;
      }
      cpfsNoLote.add(p.cpf);
    }
    inserir.push(p);
  }

  if (inserir.length === 0) {
    return {
      ok: true,
      importados: 0,
      pulados: pulados.length,
      erros,
    };
  }

  // Insere em batches de 100
  const BATCH = 100;
  const inseridosIds: string[] = [];
  for (let i = 0; i < inserir.length; i += BATCH) {
    const slice = inserir.slice(i, i + BATCH);
    const linhas = slice.map((p) => ({
      tenant_id: tenantId,
      nome: p.nome,
      cpf: p.cpf,
      telefone: p.telefone ?? "",
      email: p.email,
      data_nascimento: p.data_nascimento,
      genero: p.genero,
      convenio: p.convenio,
      observacoes: p.observacoes,
      contato_preferencial: p.telefone ? "whatsapp" : "email",
      ativo: true,
    }));
    const { data, error } = await admin
      .from("pacientes")
      .insert(linhas)
      .select("id");
    if (error) {
      // Marca todos os do batch como erro mas continua para os proximos
      for (const p of slice) {
        erros.push({
          linha: p.linha,
          nome: p.nome,
          motivo: error.message,
        });
      }
      continue;
    }
    for (const r of data ?? []) inseridosIds.push(r.id as string);
  }

  // Registra consentimento LGPD em batch para os pacientes inseridos
  if (inseridosIds.length > 0) {
    const consentimentos = inseridosIds.map((id) => ({
      paciente_id: id,
      tipo: "lgpd_geral",
      aceite: true,
      texto_aceito: LGPD_TEXT_IMPORT,
    }));
    await admin.from("consentimentos").insert(consentimentos);
  }

  revalidatePath("/pacientes");

  return {
    ok: true,
    importados: inseridosIds.length,
    pulados: pulados.length,
    erros,
  };
}
