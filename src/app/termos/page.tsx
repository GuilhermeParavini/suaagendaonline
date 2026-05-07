import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Termos de Uso" };

export default function TermosPage() {
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
              Termos de Uso
            </h1>
            <p className="mt-1 text-[13px] text-slate-500">
              Ultima atualizacao: maio de 2026
            </p>
          </div>

          <Secao titulo="1. Sobre o servico">
            <p>
              Sua Agenda Online (operada pela AGPXL) e uma plataforma de
              agendamento e gestao para profissionais da saude. O servico
              inclui agenda, cadastro de pacientes, prontuario eletronico,
              financeiro, relatorios e comunicacao com pacientes.
            </p>
            <p>
              Ao usar a plataforma, voce concorda com estes termos. Se nao
              concordar com algum ponto, por favor nao utilize o servico.
            </p>
          </Secao>

          <Secao titulo="2. Responsabilidades do usuario">
            <p>
              Voce se compromete a fornecer dados verdadeiros e atualizados, a
              nao compartilhar suas credenciais de acesso com terceiros e a
              notificar imediatamente em caso de uso nao autorizado da sua
              conta. O profissional responsavel e o controlador dos dados
              clinicos do paciente nos termos da LGPD e responde pela
              conformidade das suas atividades.
            </p>
            <p>
              Voce nao deve utilizar a plataforma para fins ilicitos, enviar
              conteudo ofensivo, tentar acessar dados de outros usuarios ou
              comprometer a seguranca do servico.
            </p>
          </Secao>

          <Secao titulo="3. Responsabilidades da plataforma">
            <p>
              Comprometemo-nos com disponibilidade tecnica adequada do
              servico, com suporte por e-mail em horario comercial, com a
              aplicacao de medidas de seguranca razoaveis para protecao dos
              dados e com o cumprimento das normas da LGPD descritas na nossa{" "}
              <Link
                href="/privacidade"
                className="text-primary-text underline"
              >
                Politica de Privacidade
              </Link>
              .
            </p>
            <p>
              Manutencoes programadas, instabilidades pontuais de provedores
              terceirizados ou falhas de rede podem causar indisponibilidade
              temporaria. Faremos esforcos razoaveis para minimizar e
              comunicar essas situacoes.
            </p>
          </Secao>

          <Secao titulo="4. Limitacoes de responsabilidade">
            <p>
              Sua Agenda Online e uma ferramenta de apoio a gestao e ao
              atendimento. Nao substituimos o conselho medico, diagnostico ou
              tratamento. As decisoes clinicas sao de responsabilidade
              exclusiva do profissional de saude que utiliza a plataforma.
            </p>
            <p>
              Recursos automatizados (transcricao de audio, sugestoes do
              assistente) sao auxiliares e nao garantem precisao absoluta. O
              profissional deve sempre revisar e validar antes de salvar no
              prontuario.
            </p>
          </Secao>

          <Secao titulo="5. Planos, cancelamento e reembolso">
            <p>
              Os planos estao descritos na pagina de Configuracoes / Meu plano.
              O cancelamento pode ser feito a qualquer momento e tem efeito ao
              final do ciclo ja pago. Em caso de pagamento anual, eventual
              reembolso e proporcional aos meses nao utilizados, descontadas
              eventuais despesas operacionais.
            </p>
            <p>
              Funcionalidades pagas adicionais (transcricao com IA, SMS) sao
              consumiveis e nao reembolsaveis apos o uso.
            </p>
          </Secao>

          <Secao titulo="6. Propriedade intelectual">
            <p>
              Os conteudos cadastrados pelo usuario (pacientes, prontuarios,
              templates) pertencem ao usuario. A plataforma, codigo, design e
              marca sao de propriedade da AGPXL.
            </p>
          </Secao>

          <Secao titulo="7. Alteracoes nos termos">
            <p>
              Podemos atualizar estes termos periodicamente. Mudancas
              significativas serao comunicadas por e-mail com pelo menos 15
              dias de antecedencia. O uso continuado apos a mudanca implica
              aceite da nova versao.
            </p>
          </Secao>

          <Secao titulo="8. Foro">
            <p>
              Fica eleito o foro da comarca de Balneario Camboriu/SC para
              dirimir quaisquer questoes decorrentes destes termos, com
              renuncia a qualquer outro, por mais privilegiado que seja.
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
            ou ler nossa{" "}
            <Link
              href="/privacidade"
              className="font-medium text-primary-text underline"
            >
              Politica de Privacidade
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
