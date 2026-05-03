import { Resend } from "resend";

// TODO: trocar para noreply@suagendaonline.com.br quando dominio verificado
const FROM_DEFAULT = "Sua Agenda Online <onboarding@resend.dev>";

let cached: Resend | null | undefined;

function getResend(): Resend | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY ausente; envios de email serao ignorados.",
    );
    cached = null;
    return null;
  }
  cached = new Resend(apiKey);
  return cached;
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from: string = FROM_DEFAULT,
): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY nao configurado." };
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: "Email de destino invalido." };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    if (error) {
      return {
        ok: false,
        error:
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : "Falha desconhecida no envio.",
      };
    }
    return { ok: true, id: (data?.id as string | undefined) ?? null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
