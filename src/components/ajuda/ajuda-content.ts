// Conteudo da Central de Ajuda do Agenda4U.
// Textos curtos e diretos. Atualize aqui quando criar novas funcionalidades.

import {
  Clock,
  Users,
  Calendar,
  Stethoscope,
  DollarSign,
  BarChart3,
  Bot,
  CreditCard,
  UserPlus,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";

export type ItemAjuda = {
  pergunta: string;
  resposta: string;
};

export type SecaoAjuda = {
  id: string;
  titulo: string;
  Icon: LucideIcon;
  itens: ItemAjuda[];
};

export const SECOES_AJUDA: SecaoAjuda[] = [
  {
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    Icon: Clock,
    itens: [
      {
        pergunta: "Como configurar seus horários de atendimento",
        resposta:
          "Vá em Configurações → aba Horários, selecione os dias da semana em que atende e defina os blocos de horário (ex.: 08h às 12h e 14h às 18h). Sem horários cadastrados, o link público de agendamento não exibe vagas.",
      },
      {
        pergunta: "Como cadastrar procedimentos",
        resposta:
          "Em Configurações → aba Procedimentos, clique em Novo procedimento. Informe nome, duração em minutos e valor opcional. Marque o procedimento como ativo para que apareça na agenda e no link público.",
      },
      {
        pergunta: "Como adicionar logo e assinatura",
        resposta:
          "Em Configurações → Meus dados, faça upload da logo (PNG/JPG/SVG até 1 MB). Em seguida, na seção Assinatura, escolha uma fonte cursiva ou envie uma imagem da sua assinatura (PNG/JPG até 500 KB). Ambas aparecem em recibos, atestados e na página pública.",
      },
      {
        pergunta: "Como compartilhar seu link de agendamento",
        resposta:
          "Em Configurações → Meus dados, na seção Link de agendamento, clique em Copiar link. Envie para o paciente por WhatsApp, e-mail ou rede social. Ele agenda sozinho, sem precisar te ligar.",
      },
    ],
  },
  {
    id: "pacientes",
    titulo: "Pacientes",
    Icon: Users,
    itens: [
      {
        pergunta: "Como cadastrar um paciente",
        resposta:
          "Acesse Pacientes → Novo paciente. Preencha nome, CPF, data de nascimento, telefone e e-mail. O sistema calcula a idade automaticamente e identifica menores de idade.",
      },
      {
        pergunta: "Como enviar link de cadastro para o paciente",
        resposta:
          "Em Configurações → Meus dados há o Link de cadastro de paciente. O paciente preenche os próprios dados, e você só revisa a ficha quando ele aparecer para a consulta. Útil para reduzir digitação no consultório.",
      },
      {
        pergunta: "Como buscar pacientes",
        resposta:
          "Use a barra de busca no topo da tela Pacientes ou aperte Ctrl + K em qualquer lugar do sistema para abrir a busca global por nome, CPF ou telefone.",
      },
      {
        pergunta: "Paciente menor de idade (responsável legal)",
        resposta:
          "Ao cadastrar um menor de 18 anos, o sistema solicita os dados do responsável legal (nome, CPF, grau de parentesco e contato). Recibos e atestados saem em nome do responsável quando exigido.",
      },
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda e agendamentos",
    Icon: Calendar,
    itens: [
      {
        pergunta: "Como agendar pelo painel",
        resposta:
          "Na agenda, clique no horário desejado ou use o botão + (canto inferior direito). Escolha o paciente (ou cadastre na hora), o procedimento e a duração. Pronto: o paciente recebe a confirmação por e-mail.",
      },
      {
        pergunta: "Como funciona o agendamento online (pelo paciente)",
        resposta:
          "O paciente abre seu link público, vê os horários livres conforme seus blocos cadastrados, escolhe procedimento e confirma. Você recebe uma notificação e o agendamento entra na sua agenda como Agendado.",
      },
      {
        pergunta: "Status dos agendamentos (cores e significados)",
        resposta:
          "Agendado (azul) é a marcação inicial. Confirmado (verde-água) quando o paciente confirma. Em atendimento (âmbar) ao iniciar. Concluído (verde) ao finalizar. Faltou (vermelho) se o paciente não comparecer. Cancelado mantém o histórico mas libera o horário.",
      },
      {
        pergunta: "Como reagendar ou cancelar",
        resposta:
          "Abra o agendamento na agenda e use os botões Reagendar ou Cancelar. Você também pode enviar ao paciente um link de reagendamento por WhatsApp — ele escolhe o novo horário sozinho.",
      },
      {
        pergunta: "Bloqueios, férias e feriados",
        resposta:
          "Em Configurações → aba Bloqueios, cadastre férias, licenças ou compromissos pessoais. Em Feriados, marque os feriados nacionais e municipais que se aplicam à sua agenda. Esses dias somem do link público automaticamente.",
      },
    ],
  },
  {
    id: "atendimento",
    titulo: "Atendimento clínico",
    Icon: Stethoscope,
    itens: [
      {
        pergunta: "Como iniciar e concluir um atendimento",
        resposta:
          "Na agenda, clique em Iniciar atendimento no card do paciente. O status muda para Em atendimento. Ao terminar, clique em Concluir — isso libera o histórico, recibo e PDFs.",
      },
      {
        pergunta: "Como registrar evolução por texto",
        resposta:
          "Na tela do atendimento, há um campo de evolução livre. Escreva o que precisar — fica salvo no prontuário do paciente, ordenado por data.",
      },
      {
        pergunta: "Como usar transcrição por voz (IA)",
        resposta:
          "Durante o atendimento, toque no botão do microfone, fale o que aconteceu na consulta e o sistema transcreve automaticamente para o campo de evolução. Cada plano tem um limite mensal de minutos.",
      },
      {
        pergunta: "O que é anamnese e como preencher",
        resposta:
          "Anamnese é o questionário clínico inicial. O Agenda4U traz templates prontos por especialidade e você pode criar campos personalizados (texto, múltipla escolha, checkbox, escala etc.). Em Configurações → aba Anamnese.",
      },
      {
        pergunta: "Como enviar pré-consulta para o paciente",
        resposta:
          "Use o link de pré-consulta (Configurações → Meus dados → Link de pré-consulta) para o paciente preencher a anamnese antes da visita. Você abre o consultório já com tudo respondido.",
      },
      {
        pergunta: "Como exportar anamnese em PDF",
        resposta:
          "Dentro do prontuário do paciente, abra a anamnese e use o botão Imprimir / PDF. O arquivo sai formatado com sua logo, dados da clínica e assinatura.",
      },
    ],
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    Icon: DollarSign,
    itens: [
      {
        pergunta: "Como registrar receitas e despesas",
        resposta:
          "Vá em Financeiro → Novo lançamento. Escolha Receita ou Despesa, informe valor, data, forma de pagamento e (opcional) o paciente. Receitas geradas pelo atendimento concluído entram automaticamente.",
      },
      {
        pergunta: "Como gerar e enviar recibos",
        resposta:
          "Após concluir o atendimento, abra-o e clique em Gerar recibo. O PDF sai com sua logo, dados do paciente e sua assinatura. Você pode baixar, imprimir ou enviar por e-mail/WhatsApp.",
      },
      {
        pergunta: "Formas de pagamento",
        resposta:
          "Dinheiro, PIX, cartão de débito, cartão de crédito à vista ou parcelado, transferência bancária e convênio. Use os filtros do Financeiro para ver o total por forma de pagamento.",
      },
    ],
  },
  {
    id: "relatorios",
    titulo: "Relatórios",
    Icon: BarChart3,
    itens: [
      {
        pergunta: "Tipos de relatórios disponíveis",
        resposta:
          "Em Relatórios você encontra: faturamento por período, pacientes (origem, faixa etária), agendamentos (status, taxa de comparecimento), inadimplência e desempenho por procedimento.",
      },
      {
        pergunta: "Como exportar em CSV",
        resposta:
          "Cada relatório tem um botão Exportar CSV no canto superior direito. O arquivo abre no Excel, Google Sheets ou Numbers.",
      },
    ],
  },
  {
    id: "assistente-ia",
    titulo: "Assistente IA",
    Icon: Bot,
    itens: [
      {
        pergunta: "O que é o assistente",
        resposta:
          "Um assistente clínico baseado em IA que responde dúvidas sobre protocolos, medicamentos, condutas e ajuda a redigir relatórios. Acesse pelo balão flutuante no canto inferior direito.",
      },
      {
        pergunta: "Exemplos de perguntas",
        resposta:
          "Quais sinais clínicos sugerem fascite plantar? Como redigir um relatório de evolução para encaminhamento? Sugira um plano de tratamento de 6 sessões para tendinite no ombro.",
      },
      {
        pergunta: "Limites de uso por plano",
        resposta:
          "Individual: 100 perguntas/mês. Equipe 3: 200/mês. Equipe 5: 350/mês. Clínica 10: 700/mês. O contador zera no dia 1 de cada mês. Se atingir o limite, faça upgrade ou aguarde a renovação.",
      },
    ],
  },
  {
    id: "planos",
    titulo: "Planos e assinatura",
    Icon: CreditCard,
    itens: [
      {
        pergunta: "Planos disponíveis e preços",
        resposta:
          "Individual (R$ 29,90/mês no anual ou R$ 39,90 mensal), Equipe 3 (R$ 39,90/R$ 49,90), Equipe 5 (R$ 49,90/R$ 59,90) e Clínica 10 (R$ 69,90/R$ 79,90). Todas as funcionalidades inclusas em todos os planos.",
      },
      {
        pergunta: "Como assinar ou trocar de plano",
        resposta:
          "Em Configurações → Meu plano, escolha o plano e o período (Mensal ou Anual) e clique em Assinar. Você é levado ao Stripe para pagamento seguro. Para trocar, basta repetir o processo com outro plano.",
      },
      {
        pergunta: "Como usar cupom de desconto",
        resposta:
          "Na tela do Stripe (após clicar em Assinar), há um campo Cupom abaixo do resumo do pedido. Insira o código e clique em Aplicar.",
      },
      {
        pergunta: "Plano anual vs mensal (aviso sobre cobrança única)",
        resposta:
          "No plano anual, você é cobrado integralmente uma vez por ano (12 meses adiantados) com cerca de 25% de desconto comparado ao mensal. A renovação automática acontece na mesma data no ano seguinte. No mensal, você é cobrado todo mês.",
      },
      {
        pergunta: "Como gerenciar assinatura (portal Stripe)",
        resposta:
          "Em Configurações → Meu plano, clique em Gerenciar assinatura. O portal do Stripe permite atualizar o cartão, ver e baixar faturas, mudar de plano ou cancelar a assinatura.",
      },
    ],
  },
  {
    id: "equipe",
    titulo: "Equipe e multi-profissional",
    Icon: UserPlus,
    itens: [
      {
        pergunta: "Como convidar profissional",
        resposta:
          "Em Configurações → aba Equipe, clique em Convidar profissional. Informe nome, e-mail e papel (admin, profissional ou secretaria). O convidado recebe um link por e-mail para criar a senha e entrar.",
      },
      {
        pergunta: "Permissões (admin, profissional, secretaria)",
        resposta:
          "Admin gerencia plano, equipe e dados da clínica. Profissional vê e edita a própria agenda, pacientes e financeiro. Secretaria vê todas as agendas, gerencia pacientes, mas não usa IA nem o financeiro consolidado.",
      },
    ],
  },
  {
    id: "dicas",
    titulo: "Dicas e atalhos",
    Icon: Lightbulb,
    itens: [
      {
        pergunta: "Como instalar no celular (PWA)",
        resposta:
          "No Chrome (Android) abra o site e use Adicionar à tela inicial. No Safari (iPhone) toque em Compartilhar → Adicionar à Tela de Início. O Agenda4U passa a abrir como um app, com ícone próprio.",
      },
      {
        pergunta: "Busca rápida (Ctrl + K)",
        resposta:
          "Aperte Ctrl + K (Cmd + K no Mac) em qualquer tela para abrir a busca global. Encontra pacientes, agendamentos e telas do sistema instantaneamente.",
      },
      {
        pergunta: "E-mails automáticos que o sistema envia",
        resposta:
          "Confirmação do agendamento, lembrete 24h antes da consulta, agradecimento pós-consulta, pedido de avaliação, aniversário do paciente e cobrança de pendências (quando habilitado). Você liga ou desliga cada um em Configurações.",
      },
    ],
  },
];
