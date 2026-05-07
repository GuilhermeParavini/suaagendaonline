import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Politica de Privacidade" };

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-14 max-w-[800px] items-center gap-3 px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded p-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            aria-label="Voltar para a pagina inicial"
          >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Voltar
          </Link>
          <p className="ml-auto text-[13px] font-semibold tracking-tight text-primary-dark">
            Sua Agenda Online
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-[28px] font-semibold text-slate-900 leading-tight">
              Politica de Privacidade
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Ultima atualizacao: maio de 2026
            </p>
          </div>

          <Secao titulo="1. Quem somos">
            <p>
              Sua Agenda Online e uma plataforma de agendamento e gestao para
              profissionais da saude, operada pela AGPXL. Esta politica explica
              como coletamos, usamos e protegemos seus dados quando voce utiliza
              nossos servicos.
            </p>
            <p>
              Para duvidas, entre em contato com{" "}
              <a
                href="mailto:contato@suagendaonline.com.br"
                className="text-primary-text underline"
              >
                contato@suagendaonline.com.br
              </a>
              .
            </p>
          </Secao>

          <Secao titulo="2. Que dados coletamos">
            <p>
              Coletamos os seguintes tipos de dados quando voce ou seu
              profissional de saude usam a plataforma:
            </p>
            <p>
              <strong>Dados do paciente:</strong> nome completo, CPF, telefone,
              e-mail, data de nascimento, genero, endereco, convenio e dados de
              saude (anamnese, evolucao clinica, diagnosticos, prescricoes,
              fotos clinicas e documentos).
            </p>
            <p>
              <strong>Dados de uso:</strong> paginas acessadas, horarios de
              acesso, dispositivo e navegador. Esses dados ajudam a manter a
              seguranca e melhorar o servico.
            </p>
            <p>
              <strong>Dados de pagamento:</strong> processados por terceiros
              (gateways de pagamento). Nao armazenamos dados completos de
              cartao de credito.
            </p>
          </Secao>

          <Secao titulo="3. Por que coletamos">
            <p>
              Os dados sao usados exclusivamente para finalidades clinicas,
              administrativas e operacionais relacionadas ao seu atendimento,
              entre elas: agendamento de consultas, comunicacao sobre o
              atendimento (confirmacao, lembrete e acompanhamento), prontuario
              eletronico e historico clinico, relatorios financeiros internos
              do profissional, e melhoria continua do servico.
            </p>
          </Secao>

          <Secao titulo="4. Como protegemos seus dados">
            <p>
              Adotamos medidas tecnicas e organizacionais para proteger suas
              informacoes: banco de dados com isolamento por profissional
              (Row-Level Security), CPF mascarado na interface sempre que
              possivel, acesso restrito por autenticacao com senha
              criptografada, log de acesso a dados sensiveis para auditoria
              interna e hospedagem em infraestrutura certificada (Supabase e
              Vercel). A comunicacao entre seu navegador e nossos servidores e
              sempre criptografada (HTTPS/TLS).
            </p>
          </Secao>

          <Secao titulo="5. Compartilhamento de dados">
            <p>
              Seus dados de saude sao acessiveis{" "}
              <strong>apenas pelo profissional responsavel</strong> pelo seu
              atendimento e pela equipe administrativa autorizada por ele. Nao
              vendemos seus dados a terceiros para fins publicitarios.
            </p>
            <p>
              Compartilhamos dados estritamente necessarios com prestadores de
              servico que apoiam a operacao da plataforma: provedor de e-mail
              (Resend), provedor de IA para transcricao opcional de audio
              (OpenAI, apenas o trecho de audio enviado pelo profissional, sem
              identificacao do paciente), e provedores de infraestrutura
              (Supabase e Vercel). Esses parceiros estao contratualmente
              obrigados a tratar os dados sob as mesmas regras de protecao.
            </p>
            <p>
              Em caso de obrigacao legal, podemos compartilhar dados mediante
              ordem judicial ou requisicao de autoridade competente.
            </p>
          </Secao>

          <Secao titulo="6. Seus direitos (LGPD)">
            <p>
              Conforme a Lei Geral de Protecao de Dados (Lei 13.709/2018),
              voce tem direito a: acessar seus dados, corrigir dados
              incorretos, solicitar a exclusao dos seus dados, revogar
              consentimento ja concedido, solicitar a portabilidade dos dados
              para outro servico e receber informacoes sobre o tratamento dos
              seus dados.
            </p>
            <p>
              Para exercer qualquer um desses direitos, entre em contato
              diretamente com seu profissional de saude (ele e o controlador
              dos dados clinicos) ou com{" "}
              <a
                href="mailto:contato@suagendaonline.com.br"
                className="text-primary-text underline"
              >
                contato@suagendaonline.com.br
              </a>
              . Atenderemos sua solicitacao em ate 15 dias uteis.
            </p>
          </Secao>

          <Secao titulo="7. Retencao de dados">
            <p>
              Dados clinicos (prontuario, anamnese, evolucao, prescricoes) sao
              mantidos por no minimo 20 anos a contar do ultimo registro,
              conforme determinacao do Conselho Federal de Medicina e
              regulamentacoes especificas para profissoes da saude.
            </p>
            <p>
              Dados de cadastro nao clinicos sao mantidos enquanto houver
              relacao ativa com o profissional. Apos uma solicitacao de
              exclusao, anonimizamos ou removemos os dados em ate 30 dias,
              exceto quando a retencao for exigida por obrigacao legal (caso
              dos prontuarios).
            </p>
          </Secao>

          <Secao titulo="8. Cookies">
            <p>
              Usamos apenas cookies essenciais para autenticacao e preferencias
              da sua sessao. Nao usamos cookies de rastreamento publicitario
              nem compartilhamos dados de navegacao com redes de anunciantes.
            </p>
          </Secao>

          <Secao titulo="9. Alteracoes nesta politica">
            <p>
              Podemos atualizar esta politica periodicamente para refletir
              mudancas legais ou operacionais. Em caso de mudancas
              significativas, notificaremos voce por e-mail. A data da ultima
              atualizacao esta sempre no topo desta pagina.
            </p>
          </Secao>

          <p className="text-[13px] text-slate-500 pt-4">
            Voltar para a{" "}
            <Link
              href="/"
              className="font-medium text-primary-text underline"
            >
              pagina inicial
            </Link>{" "}
            ou ler nossos{" "}
            <Link
              href="/termos"
              className="font-medium text-primary-text underline"
            >
              Termos de Uso
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4">
        <p className="text-center text-[11px] text-slate-500">
          Sua Agenda Online · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[18px] font-semibold text-slate-900">{titulo}</h2>
      <div className="space-y-2 text-[14px] leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}
