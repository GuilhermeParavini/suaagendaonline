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

export type DadosCadastroConfirmacao = {
  pacienteNome: string;
  profissionalNome: string;
  profissionalEspecialidade: string | null;
  linkAgendamento: string | null;
  logoUrl?: string | null;
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
  return { assunto, html: layout(conteudo, d.logoUrl) };
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
  logoUrl?: string | null;
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
          <p style="margin:0;color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">De</p>
          <p style="margin:4px 0 0 0;color:#94A3B8;font-size:14px;text-decoration:line-through;">${escapeHtml(dataPorExtenso(d.dataAnteriorIso))} às ${escapeHtml(d.horarioAnterior)}</p>
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
    ${botao}
    <p style="margin:20px 0 0 0;color:#475569;font-size:13px;">Caso precise de algo, entre em contato.</p>
    <p style="margin:16px 0 0 0;">Atenciosamente,<br>${escapeHtml(profissional)}</p>
  `;
  return { assunto, html: layout(conteudo, d.logoUrl) };
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
  return { assunto, html: layout(conteudo, d.logoUrl) };
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
