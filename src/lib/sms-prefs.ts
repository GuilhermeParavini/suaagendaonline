// Preferencias de SMS armazenadas em localStorage. Server-side os CRONs
// continuam enviando enquanto houver cota; estas flags afetam apenas a UI
// do painel (mostrar/ocultar cards, alertas e botoes manuais).

export const SMS_MODULO_KEY = "sao:sms:modulo_ativo:v1";
export const SMS_TIPOS_KEY = "sao:sms:tipos_ativos:v1";
export const SMS_ALERTA_DISMISS_KEY = "sao:sms:alerta_dismiss:v1";

export type SMSTipoChave =
  | "confirmacao"
  | "lembrete"
  | "retorno"
  | "aniversario";

export type SMSTiposPrefs = Record<SMSTipoChave, boolean>;

export const SMS_TIPOS_DEFAULT: SMSTiposPrefs = {
  confirmacao: true,
  lembrete: true,
  retorno: false,
  aniversario: false,
};

export function lerModuloSMSAtivo(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(SMS_MODULO_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function gravarModuloSMSAtivo(ativo: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SMS_MODULO_KEY, ativo ? "1" : "0");
  } catch {
    // ignore
  }
}

export function lerTiposSMSAtivos(): SMSTiposPrefs {
  if (typeof window === "undefined") return { ...SMS_TIPOS_DEFAULT };
  try {
    const raw = window.localStorage.getItem(SMS_TIPOS_KEY);
    if (!raw) return { ...SMS_TIPOS_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<SMSTiposPrefs>;
    return {
      confirmacao:
        typeof parsed.confirmacao === "boolean"
          ? parsed.confirmacao
          : SMS_TIPOS_DEFAULT.confirmacao,
      lembrete:
        typeof parsed.lembrete === "boolean"
          ? parsed.lembrete
          : SMS_TIPOS_DEFAULT.lembrete,
      retorno:
        typeof parsed.retorno === "boolean"
          ? parsed.retorno
          : SMS_TIPOS_DEFAULT.retorno,
      aniversario:
        typeof parsed.aniversario === "boolean"
          ? parsed.aniversario
          : SMS_TIPOS_DEFAULT.aniversario,
    };
  } catch {
    return { ...SMS_TIPOS_DEFAULT };
  }
}

export function gravarTiposSMSAtivos(tipos: SMSTiposPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SMS_TIPOS_KEY, JSON.stringify(tipos));
  } catch {
    // ignore
  }
}

/** Retorna true se o usuario ja dispensou o alerta de limite hoje. */
export function alertaSMSDispensadoHoje(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(SMS_ALERTA_DISMISS_KEY);
    if (!v) return false;
    const hoje = new Date().toISOString().slice(0, 10);
    return v === hoje;
  } catch {
    return false;
  }
}

export function dispensarAlertaSMS(): void {
  if (typeof window === "undefined") return;
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    window.localStorage.setItem(SMS_ALERTA_DISMISS_KEY, hoje);
  } catch {
    // ignore
  }
}
