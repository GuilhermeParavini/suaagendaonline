Manual da Marca e Design System
Sistema de Agendamento e Gestao para Profissionais da Saude
Versao 1.0 | Maio 2026 | AGPXL

Sumario

Visao geral do projeto
Identidade visual e paleta de cores
Tipografia
Icones e elementos graficos
Layout e grid
Componentes de interface
Tom de linguagem
Telas e fluxos principais
Regras de acessibilidade
Modelo de dados resumido
Stack tecnologico
Checklist de implementacao


1. Visao geral do projeto
O que e
Sistema SaaS de agendamento e gestao clinica para profissionais da saude no Brasil. PWA mobile-first, interface limpa, preco acessivel (R$ 59,90 a R$ 119,90/mes).
Publico-alvo
Podologos, fisioterapeutas, nutricionistas, psicologos, fonoaudiologos, cardiologistas e demais profissionais autonomos ou pequenas clinicas.
Proposta de valor
Preco agressivo + transcricao de audio por IA + interface intuitiva + comunicacao por e-mail (sem WhatsApp).
Empresa
AGPXL (CNPJ ativo para consultoria). Migracao para CNPJ dedicado conforme crescimento.
Decisoes firmadas

Comunicacao apenas por e-mail no lancamento. SMS sera pacote futuro cobrado por cliente.
Banco de dados: Supabase (novo projeto na conta existente).
Hospedagem: Vercel (frontend) + Hostinger (infraestrutura futura conforme necessidade).
Desenvolvimento com Claude Code.
Transcricao de audio via OpenAI Whisper ou GPT-4o Mini Transcribe.
Cadastro de paciente com calculo automatico de idade, genero (Masculino / Feminino / Prefiro nao informar), verificacao de menor de idade com responsavel legal.
Anamnese personalizavel pelo profissional com templates por especialidade.


2. Identidade visual e paleta de cores
Paleta principal: Teal medico
O teal foi escolhido por ocupar o ponto ideal entre azul (confianca, profissionalismo) e verde (saude, equilibrio). Diferencia a marca dos concorrentes que usam azul puro (iClinic, Doctoralia, GestaoDS) e transmite calma sem parecer generico.
Cores primarias
FuncaoNomeHexUsoPrimaryTeal 600#0D9488Botoes principais, links, navegacao ativa, destaquesPrimary DarkTeal 800#115E59Headers, textos sobre fundo claro, hover de botoesPrimary LightTeal 200#99F6E4Backgrounds de cards ativos, selecoes, badgesPrimary SurfaceTeal 50#F0FDFAFundo de secoes destacadas, hover sutil
Cores de accent e acao
FuncaoNomeHexUsoAccentOrange 500#F97316CTAs secundarios, gravacao de audio, alertas de atencaoAccent SurfaceOrange 50#FFF7EDBackground de notificacoes, avisos
Cores semanticas
FuncaoNomeHexUsoSuccessGreen 500#22C55EConfirmado, concluido, positivoSuccess SurfaceGreen 50#F0FDF4Background de status positivoWarningAmber 500#F59E0BEm atendimento, pendente, atencaoWarning SurfaceAmber 50#FFFBEBBackground de alertasDangerRed 500#EF4444Faltou, erro, cancelado, exclusaoDanger SurfaceRed 50#FEF2F2Background de errosInfoBlue 500#3B82F6Agendado, informativo, linksInfo SurfaceBlue 50#EFF6FFBackground informativo
Cores neutras
FuncaoNomeHexUsoText PrimarySlate 900#0F172ATitulos, textos principaisText SecondarySlate 500#64748BSubtitulos, labels, textos auxiliaresText TertiarySlate 400#94A3B8Placeholders, hints, textos desabilitadosBorder DefaultSlate 200#E2E8F0Bordas de cards, inputs, divisoresBorder HoverSlate 300#CBD5E1Bordas em estado hoverBackground PageSlate 50#F8FAFCFundo geral da paginaBackground CardWhite#FFFFFFFundo de cards e modaisBackground SurfaceSlate 100#F1F5F9Fundo de metric cards, areas secundarias
Regras de uso de cor

Nunca usar mais de 2 cores fortes por tela (primary + 1 semantica).
Fundo da pagina sempre #F8FAFC (Slate 50). Cards sempre #FFFFFF.
Vermelho apenas para erros, cancelamentos e acoes destrutivas. Nunca para CTAs.
Laranja apenas para o botao de gravacao de audio e alertas que precisam de atencao.
Status pills usam a cor Surface como fundo + cor 700/800 como texto. Nunca texto branco em pills de status.
Em dark mode (futuro), inverter para surfaces escuros mantendo a mesma logica de hierarquia.

Status de agendamento (cores fixas)
StatusCor fundoCor textoHex fundoHex textoAgendadoBlue 100Blue 800#DBEAFE#1E40AFConfirmadoTeal 100Teal 800#CCFBF1#115E59Em atendimentoAmber 100Amber 800#FEF3C7#92400EConcluidoGreen 100Green 800#D1FAE5#065F46FaltouRed 100Red 800#FEE2E2#991B1B

3. Tipografia
Fonte principal: Inter
Fonte gratuita do Google Fonts, otimizada para telas digitais, excelente legibilidade em tamanhos pequenos no mobile. Usada por Vercel, Linear, Figma e outros produtos de referencia.
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
Escala tipografica
ElementoTamanhoPesoLine-heightUsoDisplay28px6001.2Titulo principal da pagina, numeros grandesHeading 124px6001.3Titulos de secaoHeading 220px5001.3SubtitulosHeading 318px5001.4Titulos de cardsBody16px4001.6Texto corrido, descricoesBody Small14px4001.5Campos de formulario, listasLabel13px5001.4Labels de campos, nomes de colunasCaption12px4001.4Textos auxiliares, timestampsMicro11px5001.3Badges, pills de status, contadores
Regras tipograficas

Apenas 3 pesos: 400 (regular), 500 (medium), 600 (semibold). Nunca usar bold 700.
Titulos em Slate 900 (#0F172A). Subtitulos e labels em Slate 500 (#64748B).
Nunca usar texto menor que 11px.
Line-height minimo de 1.3 para titulos, 1.5 para corpo.
Largura maxima de texto corrido: 65 caracteres (aprox. 600px).
Numeros em metric cards: 22-28px, peso 500, cor primary ou semantica conforme contexto.
Sem italico em interfaces. Reservar para citacoes em conteudo editorial (raro).


4. Icones e elementos graficos
Biblioteca de icones: Lucide
Lucide (fork do Feather Icons) oferece icones consistentes, leves e limpos. Disponiveis como React components via lucide-react.
npm install lucide-react
Tamanhos padrao
ContextoTamanhoStrokeNavegacao (bottom bar)24px1.5pxBotoes com icone18px1.5pxInputs (prefixo/sufixo)16px1.5pxInline com texto14px1.5pxMetric cards20px1.5px
Icones chave do sistema
FuncaoIcone LucideAgenda/CalendarioCalendarPacientesUsersFinanceiroDollarSign ou WalletConfiguracoesSettingsNovo agendamentoPlusGravar audioMicParar gravacaoSquare (preenchido vermelho)BuscaSearchNotificacoesBellPerfil/ContaUserVoltarChevronLeftMenuMenuEditarPencilExcluirTrash2ConfirmarCheckFecharXUpload fotoCameraDocumentoFileTextHistoricoClockFiltroFilter
Regras para icones

Cor padrao: Slate 500 (#64748B). Icones ativos: Primary (#0D9488).
Nunca usar icones decorativos sem funcao. Todo icone deve comunicar uma acao ou estado.
Manter stroke em 1.5px para consistencia visual.
Em botoes, o icone fica a esquerda do texto com gap de 8px.


5. Layout e grid
Filosofia: mobile-first, simples e direto
A interface e projetada para 375px (mobile) primeiro e escala para desktop. Cada tela resolve um problema. Nada decorativo, tudo funcional.
Breakpoints
NomeLarguraUsoMobile375px-767pxLayout principal, coluna unicaTablet768px-1023px2 colunas onde aplicavelDesktop1024px+Sidebar + area principal
Grid mobile (padrao)
Margens laterais: 16px
Gap entre elementos: 12px
Cards: padding 16px
Largura maxima do conteudo: 100% - 32px (margens)
Grid desktop
Sidebar fixa: 240px (colapsavel para 64px com icones)
Area principal: flex-grow com max-width 960px, centralizada
Margens laterais: 24px
Gap entre cards: 16px
Espacamento (sistema de 4px)
TokenValorUsospace-14pxGap entre icone e texto inlinespace-28pxPadding interno de pills, gap entre pillsspace-312pxGap entre cards, padding de inputsspace-416pxPadding de cards, margens mobilespace-520pxSeparacao entre secoes dentro de cardsspace-624pxMargens desktop, separacao entre secoesspace-832pxSeparacao entre blocos principaisspace-1040pxTopo de pagina, antes de titulos principais
Border radius
ElementoRadiusBotoes8pxInputs8pxCards12pxModais16pxPills/Badges20px (full-round)Avatar50% (circulo)Calendario (dia selecionado)50%
Sombras
NivelValorUsoNenhumanenhumaPadrao para maioria dos cards (usar borda sutil)Sutil0 1px 3px rgba(0,0,0,0.08)Cards elevados, dropdownsMedia0 4px 12px rgba(0,0,0,0.1)Modais, popoversForte0 8px 24px rgba(0,0,0,0.12)Bottom sheets mobile
Regra: preferir bordas (1px solid #E2E8F0) em vez de sombras. Sombras apenas para elementos flutuantes (modais, dropdowns, bottom sheets).

6. Componentes de interface
6.1 Navegacao
Mobile (bottom navigation)
4 abas fixas no rodape:
PosicaoLabelIconeRota1AgendaCalendar/agenda2PacientesUsers/pacientes3FinanceiroWallet/financeiro4MaisMenu/menu
Especificacoes:

Altura: 56px + safe area bottom
Fundo: #FFFFFF com borda top 1px solid #E2E8F0
Icone ativo: #0D9488 (teal)
Icone inativo: #94A3B8 (slate 400)
Label: 11px, peso 500
Sem sombra no bottom bar

Desktop (sidebar)
Sidebar fixa a esquerda com os mesmos itens + itens extras:

Dashboard (Home)
Agenda
Pacientes
Financeiro
Relatorios
Configuracoes

6.2 Cards
Card padrao
cssbackground: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 12px;
padding: 16px;
Card de agendamento (lista)
[Horario]  [Nome do paciente]  [Status pill]
 09:00      Maria Silva          Confirmado

[Tipo de procedimento]
 Avaliacao podologica

[Icone] Paciente de retorno
Metric card
cssbackground: #F1F5F9;
border-radius: 8px;
padding: 12px 16px;
/* Sem borda */
Conteudo:

Label: 11-12px, Slate 500, peso 400
Numero: 22-24px, peso 500, cor conforme contexto
Variacao (opcional): 11px, verde se positivo, vermelho se negativo

6.3 Botoes
Primario
cssbackground: #0D9488;
color: #FFFFFF;
border: none;
border-radius: 8px;
padding: 10px 20px;
font-size: 14px;
font-weight: 500;
/* Hover */
background: #115E59;
/* Active */
transform: scale(0.98);
/* Disabled */
opacity: 0.5;
cursor: not-allowed;
Secundario (outline)
cssbackground: transparent;
color: #0D9488;
border: 1px solid #0D9488;
border-radius: 8px;
padding: 10px 20px;
font-size: 14px;
font-weight: 500;
/* Hover */
background: #F0FDFA;
Botao de gravacao de audio
cssbackground: #F97316;
color: #FFFFFF;
border: none;
border-radius: 8px;
padding: 10px 20px;
font-size: 14px;
font-weight: 500;
/* Gravando (estado ativo) */
background: #EF4444;
/* Animacao de pulso durante gravacao */
animation: pulse 1.5s ease-in-out infinite;
Botao destrutivo
cssbackground: transparent;
color: #EF4444;
border: 1px solid #EF4444;
border-radius: 8px;
/* Hover */
background: #FEF2F2;
6.4 Inputs
cssbackground: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 8px;
padding: 10px 12px;
font-size: 14px;
color: #0F172A;
/* Focus */
border-color: #0D9488;
box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
/* Erro */
border-color: #EF4444;
box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
Labels acima do input: 13px, peso 500, Slate 700 (#334155).
Placeholder: 14px, Slate 400 (#94A3B8).
Mensagem de erro: 12px, Red 500 (#EF4444), abaixo do input com gap de 4px.
6.5 Status pills
cssdisplay: inline-flex;
align-items: center;
padding: 3px 10px;
border-radius: 20px;
font-size: 11px;
font-weight: 500;
/* Cores conforme tabela de status de agendamento na secao 2 */
6.6 Avatar do paciente
csswidth: 40px;
height: 40px;
border-radius: 50%;
background: #CCFBF1; /* Teal 100 */
color: #115E59; /* Teal 800 */
font-size: 14px;
font-weight: 500;
display: flex;
align-items: center;
justify-content: center;
/* Exibe iniciais do nome: "MS" para Maria Silva */
6.7 Calendario
Visualizacao semanal (padrao mobile)

Header: mes/ano + setas de navegacao
Dias da semana: labels de 3 letras (Seg, Ter, Qua...) em Slate 400, 11px
Dia atual: circulo teal (#0D9488) com texto branco
Dias com agendamento: fundo teal 50 (#F0FDFA) com texto teal 800
Dias fora do mes: Slate 300

Slots de horario

Lista vertical com linhas de hora (08:00, 08:30, 09:00...)
Agendamentos como cards coloridos posicionados no slot
Drag-and-drop para reagendar (desktop)
Toque longo para reagendar (mobile)

6.8 Modal / Bottom sheet
Mobile: bottom sheet
cssbackground: #FFFFFF;
border-radius: 16px 16px 0 0;
padding: 24px 16px;
/* Barra de arraste no topo */
width: 40px;
height: 4px;
background: #CBD5E1;
border-radius: 2px;
margin: 0 auto 16px;
Desktop: modal centralizado
cssbackground: #FFFFFF;
border-radius: 16px;
padding: 24px;
max-width: 480px;
box-shadow: 0 8px 24px rgba(0,0,0,0.12);
/* Overlay */
background: rgba(0,0,0,0.4);

7. Tom de linguagem
Principios
O sistema fala com profissionais da saude. Sao pessoas praticas, ocupadas e que valorizam objetividade. A comunicacao deve ser:

Direta: frases curtas, sem rodeios. "Agendamento confirmado." e nao "Seu agendamento foi confirmado com sucesso!".
Profissional: vocabulario que o profissional da saude reconhece (anamnese, evolucao clinica, prontuario), sem ser excessivamente tecnico.
Respeitosa: tratar o profissional como par. Sem tom infantil, sem exclamacoes excessivas, sem emojis na interface principal.
Acolhedora para o paciente: quando o sistema fala com o paciente (tela de agendamento, e-mails), o tom e simples e amigavel, sem jargao medico.

Exemplos de linguagem
Titulos de tela
CorretoEvitarAgendaSua agenda de hojePacientesGerenciamento de pacientesNovo agendamentoAgendar nova consulta agoraFinanceiroControle financeiro completo
Mensagens de acao
CorretoEvitarAgendamento confirmadoAgendamento confirmado com sucesso!Paciente cadastradoPaciente cadastrado com sucesso! Parabens!Deseja excluir este agendamento?Tem certeza que deseja excluir este agendamento? Essa acao nao pode ser desfeita!Dados salvosSeus dados foram salvos com sucesso!
Mensagens de erro
CorretoEvitarHorario indisponivel. Escolha outro.Ops! Parece que esse horario ja esta ocupado.CPF invalido. Verifique o numero.O CPF informado nao e valido. Por favor, tente novamente.Conexao perdida. Tente novamente.Oops! Algo deu errado com a conexao.
E-mails para pacientes
Assunto: Confirmacao de agendamento
Ola [Nome],

Seu agendamento esta confirmado.

Profissional: [Nome do profissional]
Data: [Data por extenso]
Horario: [Hora]
Local: [Endereco]

Se precisar reagendar, acesse: [link]

Atenciosamente,
[Nome do profissional/clinica]
Assunto: Lembrete de consulta amanha
Ola [Nome],

Lembrete: voce tem consulta amanha.

Profissional: [Nome]
Horario: [Hora]

Confirme sua presenca: [link]

Atenciosamente,
[Nome do profissional/clinica]
Regras gerais de texto

Nunca usar "Sucesso!" ou "Parabens!" em mensagens do sistema.
Nunca usar "Ops!", "Oops!" ou qualquer interjeicao informal.
Evitar pontos de exclamacao. Usar apenas em CTAs de marketing (landing page).
Labels de botao: verbos no infinitivo. "Salvar", "Cancelar", "Confirmar", "Agendar".
Placeholders de input: exemplo real do dado esperado. "maria@email.com", "000.000.000-00".
Mensagens de confirmacao: uma frase. Sem paragrafo.
Mensagens de erro: descrever o problema + indicar a solucao em uma frase.
Datas sempre por extenso em comunicacao com paciente: "5 de junho de 2026".
Datas abreviadas na interface do profissional: "05/06/2026" ou "05 jun".


8. Telas e fluxos principais
8.1 Tela de login

Logo + nome do sistema centralizado
Campo de e-mail
Campo de senha
Botao "Entrar" (primario, largura total)
Link "Esqueci minha senha"
Link "Criar conta" (trial de 14 dias)
Fundo: branco. Sem imagens decorativas.

8.2 Dashboard (home do profissional)
Layout vertical mobile:
[Header: "Ola, Dra. Ana" + icone de notificacoes]

[4 metric cards em grid 2x2]
  Consultas hoje: 12
  Confirmados: 9
  Pendentes: 3
  Receita do mes: R$ 8.400

[Proximos agendamentos (lista)]
  Card de agendamento x3 com status pill

[Botao flutuante: + Novo agendamento]
8.3 Agenda (calendario)
Layout vertical mobile:
[Header: Maio 2026 + setas]

[Visualizacao semanal: faixa de 7 dias]

[Toggle: Dia | Semana | Mes]

[Lista de horarios com agendamentos]
  08:00 - Maria Silva - Confirmado
  08:30 - (livre)
  09:00 - Joao Santos - Agendado
  ...

[Botao flutuante: + Novo agendamento]
8.4 Ficha do paciente
[Header: voltar + "Paciente"]

[Avatar + Nome + idade + genero]
[Pills: Retorno | Ultima consulta: 15/04]

[Tabs: Dados | Anamnese | Historico | Documentos]

Tab Dados:
  CPF, telefone, e-mail, endereco, convenio
  Se menor: dados do responsavel legal

Tab Anamnese:
  Template da especialidade preenchido
  Campos personalizados pelo profissional

Tab Historico:
  Lista de consultas anteriores (data + resumo)
  Cada item expande para ver evolucao completa
  Transcricoes de audio vinculadas

Tab Documentos:
  Upload de fotos, laudos, exames
  Grid de thumbnails com data
8.5 Tela de atendimento (quando paciente chega)
Exibida automaticamente quando o status muda para "Em atendimento":
[Header: Nome do paciente + badge "Novo" ou "Retorno"]

[Card resumo]
  Idade: 45 anos
  Ultima consulta: 15/04/2026
  Procedimento: Avaliacao podologica

[Anamnese preenchida (colapsavel)]

[Historico de evolucoes anteriores]

[Campo de evolucao atual]
  Textarea para digitacao
  Botao "Gravar audio" (laranja, icone mic)
  Area de transcricao (aparece apos gravacao)

[Receitas e diagnosticos anteriores]

[Botoes: Salvar evolucao | Concluir atendimento]
8.6 Gravacao de audio (fluxo)
Estado 1: Botao "Gravar audio" (laranja)
  Toque para iniciar

Estado 2: Gravando
  Botao vermelho pulsando com icone de parar
  Timer: 00:00 contando
  Forma de onda animada (opcional)

Estado 3: Processando
  Indicador de loading
  Texto: "Transcrevendo..."

Estado 4: Transcricao pronta
  Texto transcrito em textarea editavel
  Botao "Usar transcricao" (primario)
  Botao "Regravar" (secundario)
  Player de audio compacto para referencia
8.7 Cadastro de paciente (preenchido pelo paciente)
[Logo + "Cadastre-se para agendar"]

Campos:
  Nome completo *
  CPF *
  Data de nascimento * (calcula idade automaticamente)
  [Exibir: "32 anos" ao lado do campo]
  Genero * (select: Masculino / Feminino / Prefiro nao informar)
  Telefone *
  E-mail *
  Endereco
  Convenio (select opcional)

[Se idade < 18, exibir bloco de responsavel:]
  Nome do responsavel *
  CPF do responsavel *
  Telefone do responsavel *
  Grau de parentesco * (select: Mae, Pai, Outro)
  Checkbox: "Declaro ser responsavel legal" *

[Termo de consentimento LGPD]
  Checkbox obrigatorio

[Botao: Cadastrar (primario, largura total)]
8.8 Agendamento online (visao do paciente)
[Header: Nome do profissional + especialidade]

[Selecao de procedimento]

[Calendario mensal com dias disponiveis]

[Horarios disponiveis do dia selecionado]
  Grid de botoes: 08:00, 08:30, 09:00...
  Horarios indisponiveis em cinza

[Resumo do agendamento]
  Profissional, procedimento, data, hora

[Botao: Confirmar agendamento]

[Confirmacao: "Agendamento confirmado. Voce recebera um e-mail de confirmacao."]
8.9 Modulo financeiro
[Header: Financeiro]

[Metric cards: Receita do mes | Despesas | Saldo]

[Toggle: Receitas | Despesas]

[Lista de lancamentos]
  Data | Paciente/Descricao | Valor | Forma pgto
  05/05 | Maria Silva | R$ 150,00 | PIX
  05/05 | Material | -R$ 45,00 | Cartao

[Filtros: Periodo, Forma de pagamento, Profissional]

[Botao: + Novo lancamento]
[Botao: Emitir recibo (por lancamento)]

9. Regras de acessibilidade
Obrigatorias

Contraste minimo de 4.5:1 para texto normal, 3:1 para texto grande (18px+).
Todos os inputs com label associado (nao usar apenas placeholder como label).
Foco visivel em todos os elementos interativos (outline teal com 3px de offset).
Textos alternativos em todas as imagens e icones funcionais.
Navegacao completa por teclado (Tab, Enter, Escape).
Areas de toque minimo de 44x44px no mobile.
Nunca transmitir informacao apenas por cor. Status pills devem ter texto alem da cor.
Formularios com validacao em tempo real e mensagens de erro claras.

Recomendadas

Suporte a leitor de tela (aria-labels, roles, live regions).
Modo de alto contraste (futuro).
Tamanho de fonte ajustavel pelo usuario (futuro).
Animacoes respeitando prefers-reduced-motion.


10. Modelo de dados resumido
Entidades principais
EntidadeCampos chaveRelacoesConta (Tenant)id, nome_empresa, plano, status_assinatura, created_at1:N Profissionais, 1:N PacientesProfissionalid, tenant_id, nome, especialidade, registro, email1:N Agendamentos, 1:N Templates AnamnesePacienteid, tenant_id, nome, CPF, telefone, email, data_nasc, genero, menor_idade1:N Agendamentos, 1:N AnamnesesResponsavelid, paciente_id, nome, CPF, telefone, grau_parentescoN:1 Paciente (menores)Consentimentoid, paciente_id, responsavel_id, tipo, aceite, data_aceite, ipN:1 PacienteAgendamentoid, profissional_id, paciente_id, data_hora, status, tolerancia_minN:1 Profissional, N:1 PacienteTemplate Anamneseid, profissional_id, especialidade, campos_jsonN:1 ProfissionalAnamneseid, paciente_id, profissional_id, template_id, dados_json, dataN:1 Paciente, N:1 TemplateEvolucaoid, anamnese_id, texto, audio_url, transcricao, dataN:1 AnamneseFinanceiroid, tenant_id, tipo, valor, forma_pagamento, dataN:1 Agendamento (opcional)Notificacaoid, tipo (email), destino, status, agendamento_idN:1 Agendamento
Isolamento de dados
Todas as tabelas possuem tenant_id. Row Level Security (RLS) do Supabase garante que um profissional nunca acesse dados de outro tenant.

11. Stack tecnologico
CamadaTecnologiaFrontendNext.js (React) + TypeScriptInterfacePWA mobile-firstBackendNode.js + Supabase Edge FunctionsBanco de dadosPostgreSQL via SupabaseAutenticacaoSupabase Auth (OAuth, JWT, MFA)Hospedagem frontendVercelHospedagem futuraHostinger (conforme necessidade)ArmazenamentoSupabase Storage (fotos, documentos, audios)E-mailAmazon SES ou ResendTranscricao de audioOpenAI Whisper ou GPT-4o Mini TranscribePagamentosStripe ou AsaasMonitoramentoSentry + Uptime RobotDesenvolvimentoClaude CodeIconesLucide ReactFonteInter (Google Fonts)

12. Checklist de implementacao
Fase 1: MVP (Mes 1-2)

 Criar projeto Supabase separado
 Configurar schema do banco com RLS
 Implementar autenticacao (Supabase Auth)
 Tela de login e cadastro do profissional
 Dashboard basico
 Agenda (visualizacao dia/semana)
 Cadastro de paciente (com menor de idade)
 Agendamento online (link compartilhavel)
 Notificacoes por e-mail (confirmacao + lembrete)
 Anamnese basica (template fixo)
 Termo de consentimento LGPD
 PWA manifest + service worker

Fase 2: Core (Mes 3-4)

 Anamnese personalizavel (editor de campos)
 Templates por especialidade
 Modulo financeiro basico
 Dashboard com metricas
 Transcricao de audio (OpenAI Whisper)
 Historico de evolucoes com transcricoes
 Emissao de recibos PDF
 Fluxo de atendimento (tela do profissional)

Fase 3: Crescimento (Mes 5-6)

 Multi-profissional por tenant
 Relatorios avancados
 Sistema de feedback/NPS pos-consulta
 PWA otimizada (offline basico, cache)
 Upload de fotos e documentos

Fase 4: Escala (Mes 7+)

 Pacote SMS opcional
 Emissao de NFe
 Prontuario evolucao avancado
 App nativo (React Native)
 Integracao gateway de pagamento (Stripe/Asaas)


Variaveis CSS (referencia rapida)
css:root {
  /* Cores primarias */
  --color-primary: #0D9488;
  --color-primary-dark: #115E59;
  --color-primary-light: #99F6E4;
  --color-primary-surface: #F0FDFA;

  /* Accent */
  --color-accent: #F97316;
  --color-accent-surface: #FFF7ED;

  /* Semanticas */
  --color-success: #22C55E;
  --color-success-surface: #F0FDF4;
  --color-warning: #F59E0B;
  --color-warning-surface: #FFFBEB;
  --color-danger: #EF4444;
  --color-danger-surface: #FEF2F2;
  --color-info: #3B82F6;
  --color-info-surface: #EFF6FF;

  /* Neutras */
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --color-text-tertiary: #94A3B8;
  --color-border: #E2E8F0;
  --color-border-hover: #CBD5E1;
  --color-bg-page: #F8FAFC;
  --color-bg-card: #FFFFFF;
  --color-bg-surface: #F1F5F9;

  /* Tipografia */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Espacamento */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
}
