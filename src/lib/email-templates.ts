const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Conjuncoes/preposicoes que ficam em minuscula no meio de um nome
const MINUSCULAS_NOME = new Set([
  "da", "de", "di", "do", "du",
  "das", "des", "dos", "dus",
  "e", "y",
]);

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

export function capitalizeNome(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  return trimmed
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((palavra, idx) => {
      if (idx > 0 && MINUSCULAS_NOME.has(palavra)) return palavra;
      return palavra.charAt(0).toLocaleUpperCase("pt-BR") + palavra.slice(1);
    })
    .join(" ");
}

export function montarLinkAgendamento(
  appUrl: string | null | undefined,
  slug: string | null | undefined,
): string | null {
  if (!appUrl || !slug) return null;
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/agendar/${slug}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function logoBlock(logoUrl: string | null | undefined): string {
  if (!logoUrl) return '';
  return `<tr>
            <td style="background-color:#FFFFFF;padding:16px;text-align:center;border-bottom:1px solid #E2E8F0;">
              <img src="${escapeHtml(logoUrl)}" alt="Logo" style="display:inline-block;max-height:48px;width:auto;object-fit:contain;" />
            </td>
          </tr>`;
}

function layout(content: string, logoUrl?: string | null): string {
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
          ${logoBlock(logoUrl)}
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

function linkBlock(linkAgendamento: string | null): string {
  if (!linkAgendamento) return "";
  return `<p style="margin:20px 0 0 0;color:#0F172A;font-size:14px;">Se precisar reagendar, acesse: <a href="${escapeHtml(linkAgendamento)}" style="color:#0D9488;text-decoration:underline;">${escapeHtml(linkAgendamento)}</a></p>`;
}

export type DadosConfirmacao = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  horario: string;
  linkAgendamento: string | null;
  logoUrl?: string | null;
};

export function emailConfirmacaoAgendamento(d: DadosConfirmacao): {
  assunto: string;
  html: string;
} {
  const assunto = "Confirmação de agendamento";
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 16px 0;">Seu agendamento está confirmado.</p>
    ${row("Profissional", profissional)}
    ${row("Data", dataPorExtenso(d.dataIso))}
    ${row("Horário", d.horario)}
    ${linkBlock(d.linkAgendamento)}
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl) };
}

export type DadosLembrete = {
  pacienteNome: string;
  profissionalNome: string;
  horario: string;
  linkAgendamento: string | null;
  logoUrl?: string | null;
};

export function emailLembrete24h(d: DadosLembrete): {
  assunto: string;
  html: string;
} {
  const assunto = "Lembrete: consulta amanhã";
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 16px 0;">Lembrete: você tem consulta amanhã.</p>
    ${row("Profissional", profissional)}
    ${row("Horário", d.horario)}
    ${linkBlock(d.linkAgendamento)}
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl) };
}

export type DadosFollowup = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  telefoneProfissional: string | null;
  mensagemPersonalizada: string | null;
  logoUrl?: string | null;
};

function formatarTelefoneBR(digits: string | null): string | null {
  if (!digits) return null;
  const d = digits.replace(/\D/g, '');
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return digits;
}

export function emailFollowupConsulta(d: DadosFollowup): {
  assunto: string;
  html: string;
} {
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const assunto = `Como você está, ${nome}?`;
  const telefone = formatarTelefoneBR(d.telefoneProfissional);
  const mensagem = (d.mensagemPersonalizada ?? '').trim();

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 12px 0;">Esperamos que esteja bem após sua consulta com ${escapeHtml(profissional)} em ${escapeHtml(dataPorExtenso(d.dataIso))}.</p>
    <p style="margin:0 0 12px 0;">Se tiver dúvidas ou precisar de algo, entre em contato${telefone ? `: <strong>${escapeHtml(telefone)}</strong>` : ''}.</p>
    ${mensagem ? `<p style="margin:16px 0 0 0;padding:12px;background-color:#F0FDFA;border-left:3px solid #0D9488;color:#0F172A;">${escapeHtml(mensagem)}</p>` : ''}
    <p style="margin:20px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl) };
}

export type DadosAvaliacao = {
  pacienteNome: string;
  profissionalNome: string;
  linkAvaliacao: string;
  logoUrl?: string | null;
};

export function emailSolicitarAvaliacao(d: DadosAvaliacao): {
  assunto: string;
  html: string;
} {
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const assunto = `Como foi sua consulta com ${profissional}?`;
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 16px 0;">Sua opinião é importante. Avalie sua consulta com ${escapeHtml(profissional)}.</p>
    <p style="margin:20px 0;">
      <a href="${escapeHtml(d.linkAvaliacao)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;">Avaliar consulta</a>
    </p>
    <p style="margin:16px 0 0 0;font-size:12px;color:#64748B;">Ou copie o link: ${escapeHtml(d.linkAvaliacao)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl) };
}

export type DadosPreConsultaConfirmacao = {
  pacienteNome: string;
  profissionalNome: string;
  profissionalEspecialidade: string | null;
  linkAgendamento: string | null;
  logoUrl?: string | null;
};

export function emailConfirmacaoPreConsulta(d: DadosPreConsultaConfirmacao): {
  assunto: string;
  html: string;
} {
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const especialidade = (d.profissionalEspecialidade ?? '').trim();
  const assunto = `Dados recebidos - ${profissional}`;
  const profissionalLabel = especialidade
    ? `${escapeHtml(profissional)} (${escapeHtml(especialidade)})`
    : escapeHtml(profissional);

  const botao = d.linkAgendamento
    ? `<p style="margin:20px 0 0 0;">Se precisar agendar, use o link abaixo:</p>
       <p style="margin:12px 0 0 0;">
         <a href="${escapeHtml(d.linkAgendamento)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;">Agendar consulta</a>
       </p>
       <p style="margin:12px 0 0 0;font-size:12px;color:#64748B;">Ou copie o link: ${escapeHtml(d.linkAgendamento)}</p>`
    : '';

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 12px 0;">Seus dados e anamnese foram recebidos por ${profissionalLabel}.</p>
    <p style="margin:0 0 12px 0;">Eles estarão disponíveis na sua próxima consulta.</p>
    ${botao}
  `;
  return { assunto, html: layout(conteudo, d.logoUrl) };
}

export type DadosCancelamento = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  horario: string;
  linkAgendamento: string | null;
  logoUrl?: string | null;
};

export function emailCancelamento(d: DadosCancelamento): {
  assunto: string;
  html: string;
} {
  const assunto = "Agendamento cancelado";
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 16px 0;">Seu agendamento foi cancelado.</p>
    ${row("Profissional", profissional)}
    ${row("Data", dataPorExtenso(d.dataIso))}
    ${row("Horário", d.horario)}
    ${linkBlock(d.linkAgendamento)}
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl) };
}
