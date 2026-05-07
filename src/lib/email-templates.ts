export const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function mesPorExtenso(mes: number): string {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return "";
  return MESES_EXTENSO[mes - 1];
}

export function mesAnoPorExtenso(mesAno: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mesAno);
  if (!m) return mesAno;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const nome = mesPorExtenso(mes);
  if (!nome) return mesAno;
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

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

export function montarLinkReagendar(
  appUrl: string | null | undefined,
  token: string | null | undefined,
): string | null {
  if (!appUrl || !token) return null;
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/reagendar/${token}`;
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

// ============================================================
// Assinatura personalizada por tenant
// ============================================================

export interface DadosAssinaturaEmail {
  nomeEmpresa: string;
  nomeProfissional: string | null;
  especialidade: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  logoUrl: string | null;
  linkAgendamento: string | null;
}

function formatTelefoneAssinatura(digits: string | null): string | null {
  if (!digits) return null;
  const d = digits.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

function formatEnderecoAssinatura(d: DadosAssinaturaEmail): string | null {
  const cidadeEstado = [d.cidade, d.estado]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(' - ');
  const partes = [d.endereco, cidadeEstado].filter(
    (s): s is string => Boolean(s && s.trim()),
  );
  return partes.length > 0 ? partes.join(', ') : null;
}

/**
 * Gera bloco HTML de assinatura para o rodape do email. Quando faltam dados
 * do tenant, retorna assinatura minima ("Enviado via Sua Agenda Online").
 */
export function gerarAssinaturaEmail(
  d: DadosAssinaturaEmail | null | undefined,
): string {
  if (!d || !d.nomeEmpresa) {
    return `<p style="margin:0;color:#64748B;font-size:12px;">Enviado via Sua Agenda Online</p>`;
  }
  const telefone = formatTelefoneAssinatura(d.telefone);
  const endereco = formatEnderecoAssinatura(d);
  const profLinha = (() => {
    if (!d.nomeProfissional) return null;
    const partes = [escapeHtml(d.nomeProfissional)];
    if (d.especialidade && d.especialidade.trim()) {
      partes.push(`<span style="color:#64748B;">· ${escapeHtml(d.especialidade.trim())}</span>`);
    }
    return partes.join(' ');
  })();
  const logoLinha = d.logoUrl
    ? `<img src="${escapeHtml(d.logoUrl)}" alt="" style="display:block;height:40px;width:auto;object-fit:contain;margin:0 auto 8px auto;" />`
    : '';
  const linhaTel = telefone
    ? `<p style="margin:2px 0 0 0;color:#475569;font-size:12px;">Telefone: <a href="tel:+55${escapeHtml(d.telefone ?? '')}" style="color:#0D9488;text-decoration:none;">${escapeHtml(telefone)}</a></p>`
    : '';
  const linhaEnd = endereco
    ? `<p style="margin:2px 0 0 0;color:#475569;font-size:12px;">${escapeHtml(endereco)}</p>`
    : '';
  const linhaLink = d.linkAgendamento
    ? `<p style="margin:8px 0 0 0;"><a href="${escapeHtml(d.linkAgendamento)}" style="display:inline-block;color:#0F766E;font-size:12px;text-decoration:underline;font-weight:500;">Agendar consulta</a></p>`
    : '';

  return `
    <div style="text-align:center;border-top:1px solid #E2E8F0;padding-top:14px;margin-top:6px;">
      ${logoLinha}
      <p style="margin:0;color:#0F172A;font-size:13px;font-weight:600;">${escapeHtml(d.nomeEmpresa)}</p>
      ${profLinha ? `<p style="margin:2px 0 0 0;color:#0F172A;font-size:12px;">${profLinha}</p>` : ''}
      ${linhaTel}
      ${linhaEnd}
      ${linhaLink}
      <p style="margin:12px 0 0 0;color:#94A3B8;font-size:11px;">Este email foi enviado por ${escapeHtml(d.nomeEmpresa)} via Sua Agenda Online.</p>
    </div>
  `;
}

function layout(
  content: string,
  logoUrl?: string | null,
  assinatura?: DadosAssinaturaEmail | null,
): string {
  const rodape = gerarAssinaturaEmail(assinatura);
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
            <td style="padding:16px 24px;background-color:#F1F5F9;border-top:1px solid #E2E8F0;">
              ${rodape}
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

function linkReagendarBlock(linkReagendar: string | null | undefined): string {
  if (!linkReagendar) return "";
  return `<p style="margin:16px 0 0 0;color:#0F172A;font-size:14px;">Precisa reagendar? <a href="${escapeHtml(linkReagendar)}" style="color:#0D9488;text-decoration:underline;font-weight:500;">Clique aqui para mudar o horario</a>.</p>`;
}

function comoChegarBlock(opts: {
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
}): string {
  const partes = [opts.endereco, [opts.cidade, opts.estado]
    .filter(Boolean)
    .join(' - ') || null]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s): s is string => s.length > 0);
  if (partes.length === 0) return '';
  const enderecoTxt = partes.join(', ');
  const linkMaps = `https://maps.google.com/?q=${encodeURIComponent(enderecoTxt)}`;
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0 0;">
      <tr>
        <td style="padding:14px;border:1px solid #E2E8F0;border-radius:8px;background-color:#F8FAFC;">
          <p style="margin:0 0 6px 0;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Como chegar</p>
          <p style="margin:0 0 10px 0;color:#0F172A;font-size:14px;line-height:1.5;">${escapeHtml(enderecoTxt)}</p>
          <p style="margin:0;">
            <a href="${escapeHtml(linkMaps)}" style="display:inline-block;background-color:#3B82F6;color:#FFFFFF;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;">Abrir no Google Maps</a>
          </p>
        </td>
      </tr>
    </table>
  `;
}

export type DadosConfirmacao = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  horario: string;
  linkAgendamento: string | null;
  linkReagendar?: string | null;
  logoUrl?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
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
    ${comoChegarBlock({ endereco: d.endereco, cidade: d.cidade, estado: d.estado })}
    ${linkReagendarBlock(d.linkReagendar)}
    ${d.linkReagendar ? "" : linkBlock(d.linkAgendamento)}
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosLembrete = {
  pacienteNome: string;
  profissionalNome: string;
  horario: string;
  linkAgendamento: string | null;
  logoUrl?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
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
    ${comoChegarBlock({ endereco: d.endereco, cidade: d.cidade, estado: d.estado })}
    ${linkBlock(d.linkAgendamento)}
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosFollowup = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  telefoneProfissional: string | null;
  mensagemPersonalizada: string | null;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
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
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosAvaliacao = {
  pacienteNome: string;
  profissionalNome: string;
  linkAvaliacao: string;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
};

export function emailSolicitarAvaliacao(d: DadosAvaliacao): {
  assunto: string;
  html: string;
} {
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const assunto = `Como foi sua consulta com ${profissional}?`;
  // Estrelas como links preenchidos com a nota correspondente. Clicar em qualquer
  // uma leva ao link de avaliacao com `?nota=N` para pre-selecionar.
  const estrelaSvg = (cor: string) =>
    `<svg width="36" height="36" viewBox="0 0 24 24" fill="${cor}" stroke="${cor}" stroke-width="1" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  const estrelasLinks = [1, 2, 3, 4, 5]
    .map((n) => {
      const url = `${d.linkAvaliacao}${d.linkAvaliacao.includes("?") ? "&" : "?"}nota=${n}`;
      return `<a href="${escapeHtml(url)}" style="display:inline-block;text-decoration:none;margin:0 4px;" aria-label="${n} ${n === 1 ? "estrela" : "estrelas"}">${estrelaSvg("#F59E0B")}</a>`;
    })
    .join("");

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}!</p>
    <p style="margin:0 0 8px 0;color:#0F172A;">Sua opinião é muito importante para nós.</p>
    <p style="margin:0 0 20px 0;color:#0F172A;">Como foi sua consulta com <strong>${escapeHtml(profissional)}</strong>?</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
      <tr>
        <td align="center" style="padding:18px 12px;background-color:#F0FDFA;border:1px solid #99F6E4;border-radius:12px;">
          <p style="margin:0 0 10px 0;color:#0F766E;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Toque em uma estrela para avaliar</p>
          <p style="margin:0;line-height:0;">${estrelasLinks}</p>
          <p style="margin:10px 0 0 0;color:#475569;font-size:12px;">Leva menos de 30 segundos.</p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px 0;text-align:center;">
      <a href="${escapeHtml(d.linkAvaliacao)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Avaliar consulta</a>
    </p>

    <p style="margin:16px 0 0 0;font-size:12px;color:#64748B;text-align:center;">Ou copie o link: <a href="${escapeHtml(d.linkAvaliacao)}" style="color:#0D9488;">${escapeHtml(d.linkAvaliacao)}</a></p>
    <p style="margin:16px 0 0 0;color:#475569;font-size:13px;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosPreConsultaConfirmacao = {
  pacienteNome: string;
  profissionalNome: string;
  profissionalEspecialidade: string | null;
  linkAgendamento: string | null;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
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
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosCadastroConfirmacao = {
  pacienteNome: string;
  profissionalNome: string;
  profissionalEspecialidade: string | null;
  linkAgendamento: string | null;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
};

export function emailConfirmacaoCadastro(d: DadosCadastroConfirmacao): {
  assunto: string;
  html: string;
} {
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const especialidade = (d.profissionalEspecialidade ?? '').trim();
  const assunto = `Cadastro confirmado - ${profissional}`;
  const profissionalLabel = especialidade
    ? `${escapeHtml(profissional)} (${escapeHtml(especialidade)})`
    : escapeHtml(profissional);

  const botao = d.linkAgendamento
    ? `<p style="margin:20px 0 0 0;">Quando precisar, agende sua consulta pelo link abaixo:</p>
       <p style="margin:12px 0 0 0;">
         <a href="${escapeHtml(d.linkAgendamento)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;">Agendar consulta</a>
       </p>
       <p style="margin:12px 0 0 0;font-size:12px;color:#64748B;">Ou copie o link: ${escapeHtml(d.linkAgendamento)}</p>`
    : '';

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 12px 0;">Seu cadastro com ${profissionalLabel} foi realizado com sucesso.</p>
    ${botao}
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosReagendamento = {
  pacienteNome: string;
  profissionalNome: string;
  profissionalEspecialidade: string | null;
  procedimentoNome: string | null;
  dataAnteriorIso: string;
  horarioAnterior: string;
  dataNovaIso: string;
  horarioNovo: string;
  linkAgendamento: string | null;
  linkReagendar?: string | null;
  logoUrl?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
};

export function emailReagendamento(d: DadosReagendamento): {
  assunto: string;
  html: string;
} {
  const nome = capitalizeNome(d.pacienteNome);
  const profissional = capitalizeNome(d.profissionalNome);
  const especialidade = (d.profissionalEspecialidade ?? '').trim();
  const procedimento = (d.procedimentoNome ?? '').trim();
  const assunto = 'Sua consulta foi reagendada';

  const blocoComparativo = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 0 0;">
      <tr>
        <td style="padding:12px;border:1px solid #E2E8F0;border-radius:8px;background-color:#F8FAFC;">
          <p style="margin:0;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">De</p>
          <p style="margin:4px 0 0 0;color:#64748B;font-size:14px;text-decoration:line-through;">${escapeHtml(dataPorExtenso(d.dataAnteriorIso))} às ${escapeHtml(d.horarioAnterior)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 12px;color:#0D9488;font-size:18px;font-weight:600;text-align:center;">↓</td>
      </tr>
      <tr>
        <td style="padding:14px;border:1px solid #0D9488;border-radius:8px;background-color:#F0FDFA;">
          <p style="margin:0;color:#0F766E;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Para</p>
          <p style="margin:4px 0 0 0;color:#0F172A;font-size:15px;font-weight:600;">${escapeHtml(dataPorExtenso(d.dataNovaIso))} às ${escapeHtml(d.horarioNovo)}</p>
        </td>
      </tr>
    </table>
  `;

  const botao = d.linkAgendamento
    ? `<p style="margin:20px 0 0 0;">
         <a href="${escapeHtml(d.linkAgendamento)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;">Ver detalhes</a>
       </p>`
    : '';

  const profissionalLabel = especialidade
    ? `${escapeHtml(profissional)} (${escapeHtml(especialidade)})`
    : escapeHtml(profissional);

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 8px 0;">Sua consulta com ${profissionalLabel} foi reagendada.</p>
    ${procedimento ? `<p style="margin:0 0 8px 0;color:#475569;">Procedimento: <strong>${escapeHtml(procedimento)}</strong></p>` : ''}
    ${blocoComparativo}
    ${comoChegarBlock({ endereco: d.endereco, cidade: d.cidade, estado: d.estado })}
    ${botao}
    ${linkReagendarBlock(d.linkReagendar)}
    <p style="margin:20px 0 0 0;color:#475569;font-size:13px;">Caso precise de algo, entre em contato.</p>
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosConvite = {
  conviteNome: string;
  convidadoPorNome: string;
  convidadoPorEspecialidade: string | null;
  clinicaNome: string;
  role: string;
  linkConvite: string;
  expiraEmDias: number;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador(a)',
  profissional: 'Profissional',
  secretaria: 'Secretaria',
};

export function emailConviteProfissional(d: DadosConvite): {
  assunto: string;
  html: string;
} {
  const nome = capitalizeNome(d.conviteNome);
  const convidadoPor = capitalizeNome(d.convidadoPorNome);
  const clinica = d.clinicaNome.trim();
  const especialidade = (d.convidadoPorEspecialidade ?? '').trim();
  const roleLabel = ROLE_LABEL[d.role] ?? d.role;
  const assunto = `Você foi convidado(a) para ${clinica}`;

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}.</p>
    <p style="margin:0 0 8px 0;">
      <strong>${escapeHtml(convidadoPor)}</strong>${especialidade ? ` (${escapeHtml(especialidade)})` : ''}
      convidou você para fazer parte de <strong>${escapeHtml(clinica)}</strong>
      como <strong>${escapeHtml(roleLabel)}</strong>.
    </p>
    <p style="margin:20px 0 0 0;">
      <a href="${escapeHtml(d.linkConvite)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;">Aceitar convite</a>
    </p>
    <p style="margin:12px 0 0 0;font-size:12px;color:#64748B;">Ou copie o link: ${escapeHtml(d.linkConvite)}</p>
    <p style="margin:16px 0 0 0;font-size:12px;color:#64748B;">O convite expira em ${d.expiraEmDias} ${d.expiraEmDias === 1 ? 'dia' : 'dias'}.</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosNovaListaEspera = {
  profissionalNome: string;
  pacienteNome: string;
  procedimentoNome: string | null;
  dataPreferencia: string | null;
  turnoPreferencia: string | null;
  observacoes: string | null;
  linkLista: string;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
};

const TURNO_LABEL_EMAIL: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  qualquer: 'Qualquer turno',
};

export function emailNovaListaEspera(d: DadosNovaListaEspera): {
  assunto: string;
  html: string;
} {
  const profissional = capitalizeNome(d.profissionalNome);
  const paciente = capitalizeNome(d.pacienteNome);
  const procedimento = (d.procedimentoNome ?? '').trim();
  const turnoLbl = d.turnoPreferencia
    ? TURNO_LABEL_EMAIL[d.turnoPreferencia] ?? d.turnoPreferencia
    : null;
  const obs = (d.observacoes ?? '').trim();
  const dataPref = d.dataPreferencia
    ? dataPorExtenso(d.dataPreferencia)
    : null;
  const assunto = 'Novo paciente na lista de espera';

  const detalhes: string[] = [];
  if (procedimento) detalhes.push(row('Procedimento', procedimento));
  if (dataPref) detalhes.push(row('Data preferida', dataPref));
  if (turnoLbl) detalhes.push(row('Turno', turnoLbl));
  if (obs) detalhes.push(row('Observações', obs));

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(profissional)}.</p>
    <p style="margin:0 0 8px 0;"><strong>${escapeHtml(paciente)}</strong> entrou na lista de espera.</p>
    ${detalhes.join('')}
    <p style="margin:20px 0 0 0;">
      <a href="${escapeHtml(d.linkLista)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:500;">Ver lista de espera</a>
    </p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

// ============================================================
// Dicas de funcionalidades nao usadas
// ============================================================

export type FuncionalidadeKey =
  | "estoque"
  | "relatorios"
  | "plano_tratamento"
  | "transcricao"
  | "pre_consulta";

export interface DadosFuncionalidadeNaoUsada {
  nome: string;
  funcionalidadeNome: string;
  iconeEmoji: string;
  descricao: string;
  comoUsar: string;
  linkCTA: string;
  textoCTA: string;
  funcionalidadeKey: FuncionalidadeKey;
  configLink: string;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
}

export function emailFuncionalidadeNaoUsada(
  d: DadosFuncionalidadeNaoUsada,
): { assunto: string; html: string } {
  const nome = capitalizeNome(d.nome);
  const assunto = `Voce sabia? ${d.funcionalidadeNome} pode te ajudar`;
  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}!</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
      <tr>
        <td align="center" style="padding:24px 16px;background-color:#F0FDFA;border:1px solid #99F6E4;border-radius:12px;">
          <div style="font-size:40px;line-height:1;margin-bottom:8px;" aria-hidden="true">${d.iconeEmoji}</div>
          <p style="margin:0;color:#0F766E;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Dica de funcionalidade</p>
          <h2 style="margin:6px 0 0 0;color:#0F172A;font-size:20px;font-weight:600;">${escapeHtml(d.funcionalidadeNome)}</h2>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px 0;color:#0F172A;font-size:14px;line-height:1.6;">${escapeHtml(d.descricao)}</p>
    <p style="margin:0 0 20px 0;color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(d.comoUsar)}</p>

    <p style="margin:0 0 16px 0;text-align:center;">
      <a href="${escapeHtml(d.linkCTA)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(d.textoCTA)}</a>
    </p>

    <p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;line-height:1.6;">
      Enviamos esta dica porque notamos que voce ainda nao usa ${escapeHtml(d.funcionalidadeNome)}.
      Para parar de receber dicas, acesse <a href="${escapeHtml(d.configLink)}" style="color:#0D9488;">configuracoes</a> e desative o aviso.
    </p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosCancelamento = {
  pacienteNome: string;
  profissionalNome: string;
  dataIso: string;
  horario: string;
  linkAgendamento: string | null;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
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
  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

// ============================================================
// Comissoes mensais
// ============================================================

const formatadorBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function brl(value: number): string {
  return formatadorBRL.format(Number.isFinite(value) ? value : 0);
}

const FORMA_PAGAMENTO_LABEL_COM: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  convenio: "Convênio",
  transferencia: "Transferência",
  outro: "Outro",
};

function formaLabelCom(key: string): string {
  return FORMA_PAGAMENTO_LABEL_COM[key] ?? key;
}

export type DadosRelatorioProfissional = {
  nome: string;
  mesAno: string;
  faturamentoBruto: number;
  totalAtendimentos: number;
  detalhamentoPagamentos:
    | Record<string, number | { valor: number; quantidade: number }>
    | null;
  percentual: number;
  valorComissaoPercentual: number;
  valorFixoMensal: number;
  totalComissao: number;
  valorLiquido: number;
  totalDespesas: number;
  detalhamentoDespesas: Record<string, number> | null;
  lucroReal: number;
  appUrl: string | null;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
};

function listaPagamentosHtml(
  detalhamento:
    | Record<string, number | { valor: number; quantidade: number }>
    | null,
  showCount: boolean,
  totalForPercent?: number,
): string {
  if (!detalhamento) return "";
  const linhas: string[] = [];
  for (const [forma, val] of Object.entries(detalhamento)) {
    const valor =
      typeof val === "number" ? val : ((val as { valor?: number }).valor ?? 0);
    const qtd =
      typeof val === "object" && val !== null
        ? ((val as { quantidade?: number }).quantidade ?? 0)
        : 0;
    const pct =
      totalForPercent && totalForPercent > 0
        ? `${Math.round((valor / totalForPercent) * 100)}% — `
        : "";
    const sufixo =
      showCount && qtd > 0
        ? ` (${qtd} ${qtd === 1 ? "atendimento" : "atendimentos"})`
        : "";
    linhas.push(
      `<li style="margin:4px 0;color:#0F172A;font-size:14px;">${escapeHtml(formaLabelCom(forma))}: ${pct}<strong>${escapeHtml(brl(valor))}</strong>${escapeHtml(sufixo)}</li>`,
    );
  }
  if (linhas.length === 0) return "";
  return `<ul style="margin:6px 0 0 0;padding:0 0 0 18px;">${linhas.join("")}</ul>`;
}

function despesasHtml(detalhamento: Record<string, number> | null): string {
  if (!detalhamento) return "";
  const linhas: string[] = [];
  for (const [cat, valor] of Object.entries(detalhamento)) {
    linhas.push(
      `<li style="margin:4px 0;color:#0F172A;font-size:14px;">${escapeHtml(cat)}: <strong>${escapeHtml(brl(Number(valor) || 0))}</strong></li>`,
    );
  }
  if (linhas.length === 0) return "";
  return `<ul style="margin:6px 0 0 0;padding:0 0 0 18px;">${linhas.join("")}</ul>`;
}

export function emailRelatorioProfissional(
  d: DadosRelatorioProfissional,
): { assunto: string; html: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(d.mesAno);
  const ano = m ? m[1] : "";
  const mesNum = m ? Number(m[2]) : 0;
  const mesNome = mesPorExtenso(mesNum);
  const mesLabel = `${mesNome.charAt(0).toUpperCase()}${mesNome.slice(1)}`;

  const assunto = `Relatorio Mensal — ${mesLabel}/${ano} | Sua Agenda Online`;
  const nome = capitalizeNome(d.nome);

  const linkRelatorio = d.appUrl
    ? `${d.appUrl.replace(/\/+$/, "")}/financeiro`
    : null;

  const secaoFormas = listaPagamentosHtml(
    d.detalhamentoPagamentos,
    true,
    d.faturamentoBruto,
  );

  const secaoDespesas =
    d.totalDespesas > 0
      ? `
    <div style="margin:16px 0 0 0;padding:12px 14px;border:1px solid #E2E8F0;border-radius:10px;background-color:#F8FAFC;">
      <p style="margin:0;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Despesas do mes</p>
      <p style="margin:6px 0 0 0;color:#0F172A;font-size:14px;">Total: <strong>${escapeHtml(brl(d.totalDespesas))}</strong></p>
      ${despesasHtml(d.detalhamentoDespesas)}
    </div>`
      : "";

  const linhaFixo =
    d.valorFixoMensal > 0
      ? `<p style="margin:6px 0 0 0;color:#0F172A;font-size:14px;">Valor fixo mensal: <strong>${escapeHtml(brl(d.valorFixoMensal))}</strong></p>`
      : "";

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}!</p>
    <p style="margin:0 0 16px 0;color:#0F172A;">Aqui esta seu relatorio de ${escapeHtml(mesNome)}/${escapeHtml(ano)}:</p>

    <div style="margin:0;padding:14px 16px;background-color:#F1F5F9;border-radius:10px;">
      <p style="margin:0;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Resumo do mes</p>
      <p style="margin:6px 0 0 0;color:#0F172A;font-size:14px;">Total de atendimentos: <strong>${d.totalAtendimentos}</strong></p>
      <p style="margin:4px 0 0 0;color:#0F172A;font-size:14px;">Faturamento bruto: <strong>${escapeHtml(brl(d.faturamentoBruto))}</strong></p>
    </div>

    ${
      secaoFormas
        ? `
      <div style="margin:14px 0 0 0;padding:12px 14px;border:1px solid #E2E8F0;border-radius:10px;background-color:#FFFFFF;">
        <p style="margin:0;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Por forma de pagamento</p>
        ${secaoFormas}
      </div>`
        : ""
    }

    <div style="margin:14px 0 0 0;padding:14px 16px;background-color:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;">
      <p style="margin:0;color:#92400E;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Comissao da clinica</p>
      <p style="margin:6px 0 0 0;color:#0F172A;font-size:14px;">Percentual: <strong>${String(d.percentual).replace(".", ",")}%</strong></p>
      <p style="margin:4px 0 0 0;color:#0F172A;font-size:14px;">Valor da comissao: <strong>${escapeHtml(brl(d.valorComissaoPercentual))}</strong></p>
      ${linhaFixo}
      <p style="margin:8px 0 0 0;color:#92400E;font-size:16px;">Total a pagar: <strong>${escapeHtml(brl(d.totalComissao))}</strong></p>
    </div>

    <div style="margin:14px 0 0 0;padding:16px;background-color:#F0FDFA;border:1px solid #99F6E4;border-radius:10px;text-align:center;">
      <p style="margin:0;color:#0F766E;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Seu liquido</p>
      <p style="margin:8px 0 0 0;color:#0F172A;font-size:24px;font-weight:700;">${escapeHtml(brl(d.valorLiquido))}</p>
    </div>

    ${secaoDespesas}

    <div style="margin:14px 0 0 0;padding:14px 16px;background-color:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;">
      <p style="margin:0;color:#15803D;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Resultado final</p>
      <p style="margin:6px 0 0 0;color:#0F172A;font-size:14px;">Liquido apos comissao: ${escapeHtml(brl(d.valorLiquido))}</p>
      <p style="margin:4px 0 0 0;color:#0F172A;font-size:14px;">Menos despesas: ${escapeHtml(brl(d.totalDespesas))}</p>
      <p style="margin:8px 0 0 0;color:#15803D;font-size:18px;font-weight:700;">Lucro real: ${escapeHtml(brl(d.lucroReal))}</p>
    </div>

    <p style="margin:16px 0 0 0;text-align:center;">
      <span style="display:inline-block;background-color:#FEF3C7;color:#92400E;padding:4px 10px;border-radius:9999px;font-size:12px;font-weight:600;">Status: Pendente</span>
    </p>

    ${
      linkRelatorio
        ? `
    <p style="margin:20px 0 0 0;text-align:center;">
      <a href="${escapeHtml(linkRelatorio)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Ver Relatorio Completo</a>
    </p>`
        : ""
    }
  `;

  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}

export type DadosRelatorioAdminProfissional = {
  nome: string;
  faturado: number;
  percentual: number;
  comissao: number;
  fixo: number;
  total: number;
  status: "aberto" | "pago" | "cancelado";
};

export type DadosRelatorioAdmin = {
  nomeAdmin: string;
  mesAno: string;
  faturamentoTotal: number;
  totalAtendimentosGeral: number;
  ticketMedio: number;
  profissionais: DadosRelatorioAdminProfissional[];
  totalComissoesReceber: number;
  totalFixosReceber: number;
  detalhamentoPagamentosGeral: Record<string, number> | null;
  adminAtende: boolean;
  adminAtendimentos: number;
  adminFaturamento: number;
  appUrl: string | null;
  logoUrl?: string | null;
  assinatura?: DadosAssinaturaEmail | null;
};

export function emailRelatorioAdmin(
  d: DadosRelatorioAdmin,
): { assunto: string; html: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(d.mesAno);
  const ano = m ? m[1] : "";
  const mesNum = m ? Number(m[2]) : 0;
  const mesNome = mesPorExtenso(mesNum);
  const mesLabel = `${mesNome.charAt(0).toUpperCase()}${mesNome.slice(1)}`;

  const assunto = `Relatorio da Clinica — ${mesLabel}/${ano} | Sua Agenda Online`;
  const nome = capitalizeNome(d.nomeAdmin);

  const linkFinanceiro = d.appUrl
    ? `${d.appUrl.replace(/\/+$/, "")}/financeiro`
    : null;

  const linhasTabela = d.profissionais
    .map((p) => {
      const statusLbl = p.status === "pago" ? "Pago" : "Pendente";
      const statusBg = p.status === "pago" ? "#D1FAE5" : "#FEF3C7";
      const statusColor = p.status === "pago" ? "#065F46" : "#92400E";
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;">${escapeHtml(p.nome)}</td>
        <td style="padding:8px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;text-align:right;">${escapeHtml(brl(p.faturado))}</td>
        <td style="padding:8px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;text-align:right;">${String(p.percentual).replace(".", ",")}%</td>
        <td style="padding:8px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;text-align:right;">${escapeHtml(brl(p.comissao))}</td>
        <td style="padding:8px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;text-align:right;">${escapeHtml(brl(p.fixo))}</td>
        <td style="padding:8px;border-bottom:1px solid #E2E8F0;text-align:center;"><span style="display:inline-block;background-color:${statusBg};color:${statusColor};padding:3px 8px;border-radius:9999px;font-size:11px;font-weight:600;">${statusLbl}</span></td>
      </tr>`;
    })
    .join("");

  const totalFaturado = d.profissionais.reduce(
    (acc, p) => acc + p.faturado,
    0,
  );
  const totalComissao = d.profissionais.reduce(
    (acc, p) => acc + p.comissao,
    0,
  );
  const totalFixo = d.profissionais.reduce((acc, p) => acc + p.fixo, 0);

  const linhaTotal = `
    <tr>
      <td style="padding:10px 8px;color:#0F172A;font-size:13px;font-weight:700;">Total</td>
      <td style="padding:10px 8px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;">${escapeHtml(brl(totalFaturado))}</td>
      <td style="padding:10px 8px;color:#0F172A;font-size:13px;text-align:right;">—</td>
      <td style="padding:10px 8px;color:#92400E;font-size:13px;font-weight:700;text-align:right;">${escapeHtml(brl(totalComissao))}</td>
      <td style="padding:10px 8px;color:#1E40AF;font-size:13px;font-weight:700;text-align:right;">${escapeHtml(brl(totalFixo))}</td>
      <td style="padding:10px 8px;"></td>
    </tr>`;

  const tabelaProfissionais =
    d.profissionais.length > 0
      ? `
    <div style="margin:14px 0 0 0;">
      <p style="margin:0 0 8px 0;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Comissoes a receber</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background-color:#F8FAFC;">
            <th style="padding:8px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600;">Profissional</th>
            <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600;">Faturado</th>
            <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600;">%</th>
            <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600;">Comissao</th>
            <th style="padding:8px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600;">Fixo</th>
            <th style="padding:8px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748B;font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>${linhasTabela}${linhaTotal}</tbody>
      </table>
    </div>`
      : "";

  const secaoFormas = listaPagamentosHtml(
    d.detalhamentoPagamentosGeral,
    false,
    d.faturamentoTotal,
  );

  const secaoAdmin = d.adminAtende
    ? `
    <div style="margin:14px 0 0 0;padding:14px 16px;background-color:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;">
      <p style="margin:0;color:#1E40AF;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Seus atendimentos</p>
      <p style="margin:6px 0 0 0;color:#0F172A;font-size:14px;">Atendimentos: <strong>${d.adminAtendimentos}</strong></p>
      <p style="margin:4px 0 0 0;color:#0F172A;font-size:14px;">Faturamento: <strong>${escapeHtml(brl(d.adminFaturamento))}</strong></p>
      <p style="margin:6px 0 0 0;color:#475569;font-size:12px;font-style:italic;">(Sem comissao — voce e a admin)</p>
    </div>`
    : "";

  const conteudo = `
    <p style="margin:0 0 12px 0;font-size:16px;font-weight:600;">Olá, ${escapeHtml(nome)}!</p>
    <p style="margin:0 0 16px 0;color:#0F172A;">Aqui esta o relatorio geral da clinica em ${escapeHtml(mesNome)}/${escapeHtml(ano)}:</p>

    <div style="margin:0;padding:14px 16px;background-color:#F0FDFA;border:1px solid #99F6E4;border-radius:10px;">
      <p style="margin:0;color:#0F766E;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:700;">Consolidado da clinica</p>
      <p style="margin:6px 0 0 0;color:#0F172A;font-size:14px;">Faturamento total: <strong>${escapeHtml(brl(d.faturamentoTotal))}</strong></p>
      <p style="margin:4px 0 0 0;color:#0F172A;font-size:14px;">Total de atendimentos: <strong>${d.totalAtendimentosGeral}</strong></p>
      <p style="margin:4px 0 0 0;color:#0F172A;font-size:14px;">Ticket medio: <strong>${escapeHtml(brl(d.ticketMedio))}</strong></p>
    </div>

    ${tabelaProfissionais}

    ${
      secaoFormas
        ? `
      <div style="margin:14px 0 0 0;padding:12px 14px;border:1px solid #E2E8F0;border-radius:10px;background-color:#FFFFFF;">
        <p style="margin:0;color:#64748B;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Formas de pagamento (geral)</p>
        ${secaoFormas}
      </div>`
        : ""
    }

    ${secaoAdmin}

    <p style="margin:12px 0 0 0;color:#475569;font-size:13px;">A receber em comissoes: <strong>${escapeHtml(brl(d.totalComissoesReceber))}</strong> · A receber em fixos: <strong>${escapeHtml(brl(d.totalFixosReceber))}</strong></p>

    ${
      linkFinanceiro
        ? `
    <p style="margin:20px 0 0 0;text-align:center;">
      <a href="${escapeHtml(linkFinanceiro)}" style="display:inline-block;background-color:#0D9488;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Gerenciar Comissoes</a>
    </p>`
        : ""
    }
  `;

  return { assunto, html: layout(conteudo, d.logoUrl, d.assinatura) };
}
