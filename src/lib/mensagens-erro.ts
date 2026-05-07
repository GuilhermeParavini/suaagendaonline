// Traducao de mensagens tecnicas (Postgres / Supabase / fetch) para
// linguagem humana, conforme tom de voz definido no Manual da Marca.
// Sempre logue o erro original (console.error) — esta funcao e apenas
// para apresentacao ao usuario.

type ErroComCampos = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

const REGRAS: Array<{ teste: RegExp; mensagem: string | ((m: string) => string) }> = [
  {
    teste: /unique violation.*cpf|duplicate key.*cpf|cpf.*already.*exists|cpf.*duplicad/i,
    mensagem: "Ja existe um paciente com este CPF.",
  },
  {
    teste: /unique violation.*email|duplicate key.*email/i,
    mensagem: "Ja existe um cadastro com este e-mail.",
  },
  {
    teste: /unique violation.*slug|duplicate key.*slug/i,
    mensagem: "Este link ja esta em uso. Escolha outro.",
  },
  {
    teste: /duplicate key|unique violation|23505/i,
    mensagem: "Ja existe um registro com esses dados.",
  },
  {
    teste: /foreign key violation|violates foreign key|23503/i,
    mensagem: "Este registro esta vinculado a outros dados e nao pode ser alterado.",
  },
  {
    teste: /check constraint|violates check|23514/i,
    mensagem: "Valor invalido para este campo.",
  },
  {
    teste: /not.?null violation|null value in column|23502/i,
    mensagem: "Este campo e obrigatorio.",
  },
  {
    teste: /row.?level security|new row violates row-level security|42501|insufficient.?privilege/i,
    mensagem: "Voce nao tem permissao para esta acao.",
  },
  {
    teste: /JWT expired|invalid JWT|token.*expir|session.*expir/i,
    mensagem: "Sua sessao expirou. Entre novamente.",
  },
  {
    teste: /invalid login credentials|invalid email or password/i,
    mensagem: "E-mail ou senha incorretos.",
  },
  {
    teste: /email not confirmed/i,
    mensagem: "Confirme seu e-mail antes de entrar.",
  },
  {
    teste: /rate limit|too many requests|429/i,
    mensagem: "Muitas tentativas. Aguarde um instante e tente novamente.",
  },
  {
    teste: /payload too large|file too big|413/i,
    mensagem: "Arquivo muito grande. Reduza o tamanho e tente novamente.",
  },
  {
    teste: /network|fetch failed|failed to fetch|enotfound|econnrefused|timed?out/i,
    mensagem: "Conexao perdida. Tente novamente.",
  },
  {
    teste: /storage.*not found|object.*not.*found|404/i,
    mensagem: "Arquivo nao encontrado.",
  },
  {
    teste: /value too long|22001/i,
    mensagem: "O texto informado excede o tamanho permitido.",
  },
  {
    teste: /invalid input syntax.*uuid/i,
    mensagem: "Identificador invalido.",
  },
  {
    teste: /invalid input syntax.*date|invalid input syntax.*timestamp/i,
    mensagem: "Data invalida. Verifique o formato.",
  },
  {
    teste: /invalid input syntax.*number|invalid input syntax.*integer/i,
    mensagem: "Valor numerico invalido.",
  },
];

export function traduzirErro(erro: unknown, fallback?: string): string {
  if (!erro) return fallback ?? "Nao foi possivel concluir. Tente novamente.";

  if (typeof erro === "string") {
    return aplicarRegras(erro) ?? fallback ?? erro;
  }

  if (erro instanceof Error) {
    const m = aplicarRegras(erro.message);
    if (m) return m;
    return fallback ?? "Nao foi possivel concluir. Tente novamente.";
  }

  const obj = erro as ErroComCampos;
  const partes = [obj.message, obj.code, obj.details, obj.hint]
    .filter((v) => typeof v === "string")
    .join(" ");
  const m = aplicarRegras(partes);
  if (m) return m;
  return fallback ?? "Nao foi possivel concluir. Tente novamente.";
}

function aplicarRegras(texto: string): string | null {
  if (!texto) return null;
  for (const regra of REGRAS) {
    if (regra.teste.test(texto)) {
      return typeof regra.mensagem === "function"
        ? regra.mensagem(texto)
        : regra.mensagem;
    }
  }
  return null;
}
