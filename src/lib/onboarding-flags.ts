// Flags do checklist de primeiro uso mantidas no client (localStorage).
// O servidor nao tem como saber se o profissional ja copiou o link de
// agendamento publico, portanto registramos isso aqui no navegador.
// Tambem registramos quando o checklist inteiro virou "completo" para
// poder esconder o card de parabens 1 dia depois (sem persistir no banco).

const KEY_LINK_COMPARTILHADO = 'sao:link-compartilhado';
const KEY_CHECKLIST_COMPLETO_EM = 'sao:checklist-completo-em';

export function lerLinkCompartilhado(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEY_LINK_COMPARTILHADO) === '1';
  } catch {
    return false;
  }
}

export function marcarLinkCompartilhado(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY_LINK_COMPARTILHADO, '1');
    window.dispatchEvent(new Event('sao:checklist-mudou'));
  } catch {
    // localStorage indisponivel (modo privado/restricoes) — ignorar.
  }
}

export function lerChecklistCompletoEm(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY_CHECKLIST_COMPLETO_EM);
    if (!raw) return null;
    const v = Number.parseInt(raw, 10);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function marcarChecklistCompletoAgora(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(KEY_CHECKLIST_COMPLETO_EM)) return;
    window.localStorage.setItem(
      KEY_CHECKLIST_COMPLETO_EM,
      String(Date.now()),
    );
  } catch {
    // ignorar
  }
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function checklistConcluidoExpirou(
  completoEm: number | null,
): boolean {
  if (completoEm === null) return false;
  return Date.now() - completoEm >= UM_DIA_MS;
}
