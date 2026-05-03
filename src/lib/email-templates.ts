const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function dataPorExtenso(dataIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataIso);
  if (!match) return dataIso;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  if (mes < 1 || mes > 12) return dataIso;
  return `${dia} de ${MESES_EXTENSO[mes - 1]} de ${ano}`;
}

export function horarioFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function dataIsoFromTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F8FAFC;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#0D9488;padding:18px 24px;">
              <p style="margin:0;color:#FFFFFF;font-size:14px;font-weight:600;letter-spacing:0.2px;">Sua Agenda Online</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#0F172A;font-size:14px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background-color:#F1F5F9;border-top:1px solid #E2E8F0;text-align:center;">
              <p style="margin:0;color:#64748B;font-size:12px;">Sua Agenda Online · Sistema de agendamento</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<p style="margin:6px 0;color:#0F172A;font-size:14px;">
  <strong style="color:#64748B;font-weight:500;">${escapeHtml(label)}:</strong>
  ${escapeHtml(value)}
</p>`;
}

export type DadosConfirmacao = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  horario: string;
};

export function emailConfirmacaoAgendamento(d: DadosConfirmacao): {
  assunto: string;
  html: string;
} {
  const assunto = "Confirmação de agendamento";
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(d.pacienteNome)}.</p>
    <p style="margin:0 0 16px 0;">Seu agendamento está confirmado.</p>
    ${row("Profissional", d.profissionalNome)}
    ${row("Data", dataPorExtenso(d.dataIso))}
    ${row("Horário", d.horario)}
    <p style="margin:20px 0 0 0;color:#64748B;font-size:13px;">Se precisar reagendar, entre em contato.</p>
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(d.profissionalNome)}</p>
  `;
  return { assunto, html: layout(conteudo) };
}

export type DadosLembrete = {
  pacienteNome: string;
  profissionalNome: string;
  horario: string;
};

export function emailLembrete24h(d: DadosLembrete): {
  assunto: string;
  html: string;
} {
  const assunto = "Lembrete: consulta amanhã";
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(d.pacienteNome)}.</p>
    <p style="margin:0 0 16px 0;">Lembrete: você tem consulta amanhã.</p>
    ${row("Profissional", d.profissionalNome)}
    ${row("Horário", d.horario)}
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(d.profissionalNome)}</p>
  `;
  return { assunto, html: layout(conteudo) };
}

export type DadosCancelamento = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  horario: string;
  linkAgendamento: string | null;
};

export function emailCancelamento(d: DadosCancelamento): {
  assunto: string;
  html: string;
} {
  const assunto = "Agendamento cancelado";
  const linkBlock = d.linkAgendamento
    ? `<p style="margin:16px 0 0 0;">Para reagendar, acesse: <a href="${escapeHtml(d.linkAgendamento)}" style="color:#0D9488;text-decoration:underline;">${escapeHtml(d.linkAgendamento)}</a></p>`
    : "";
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(d.pacienteNome)}.</p>
    <p style="margin:0 0 16px 0;">Seu agendamento foi cancelado.</p>
    ${row("Profissional", d.profissionalNome)}
    ${row("Data", dataPorExtenso(d.dataIso))}
    ${row("Horário", d.horario)}
    ${linkBlock}
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(d.profissionalNome)}</p>
  `;
  return { assunto, html: layout(conteudo) };
}
