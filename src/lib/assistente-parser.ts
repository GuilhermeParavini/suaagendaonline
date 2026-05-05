export type FollowUpCard = {
  texto: string;
  pergunta: string;
};

export type RespostaAssistenteParsed = {
  texto: string;
  followUps: FollowUpCard[];
};

const INICIO = '|||FOLLOW_UP|||';
const FIM = '|||END_FOLLOW_UP|||';
const MAX_TEXTO = 60;
const MAX_PERGUNTA = 200;
const MAX_ITENS = 3;

function sanitizeItem(raw: unknown): FollowUpCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const texto = typeof obj.texto === 'string' ? obj.texto.trim() : '';
  const pergunta = typeof obj.pergunta === 'string' ? obj.pergunta.trim() : '';
  if (!texto || !pergunta) return null;
  return {
    texto: texto.length > MAX_TEXTO ? texto.slice(0, MAX_TEXTO) : texto,
    pergunta:
      pergunta.length > MAX_PERGUNTA
        ? pergunta.slice(0, MAX_PERGUNTA)
        : pergunta,
  };
}

export function parseRespostaAssistente(
  resposta: string,
): RespostaAssistenteParsed {
  if (typeof resposta !== 'string' || resposta.length === 0) {
    return { texto: '', followUps: [] };
  }

  const idxInicio = resposta.indexOf(INICIO);
  const idxFim = resposta.indexOf(FIM);
  if (idxInicio === -1 || idxFim === -1 || idxFim < idxInicio) {
    return { texto: resposta.trim(), followUps: [] };
  }

  const trecho = resposta.slice(idxInicio + INICIO.length, idxFim).trim();
  let followUps: FollowUpCard[] = [];
  try {
    const parsed = JSON.parse(trecho);
    if (Array.isArray(parsed)) {
      followUps = parsed
        .map(sanitizeItem)
        .filter((c): c is FollowUpCard => c !== null)
        .slice(0, MAX_ITENS);
    }
  } catch {
    followUps = [];
  }

  const textoLimpo = (
    resposta.slice(0, idxInicio) + resposta.slice(idxFim + FIM.length)
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { texto: textoLimpo, followUps };
}
