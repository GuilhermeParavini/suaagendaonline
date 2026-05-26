import {
  CalendarDays,
  Users,
  FileText,
  Mic,
  Bot,
  DollarSign,
} from "lucide-react";

const FEATURES = [
  {
    Icon: CalendarDays,
    titulo: "Agenda inteligente",
    descricao:
      "Calendário visual, agendamento online pelo paciente, bloqueio de horários, feriados e férias.",
  },
  {
    Icon: Users,
    titulo: "Cadastro completo de pacientes",
    descricao:
      "Ficha clínica, histórico, documentos, menor de idade com responsável legal automático.",
  },
  {
    Icon: FileText,
    titulo: "Anamnese personalizável",
    descricao:
      "Templates prontos para sua especialidade. Crie seus próprios campos. Tudo digital.",
  },
  {
    Icon: Mic,
    titulo: "Transcrição por IA",
    descricao:
      "Grave o atendimento por voz e o sistema transcreve automaticamente. Chega de digitar evoluções.",
  },
  {
    Icon: Bot,
    titulo: "Assistente com IA",
    descricao:
      "Tire dúvidas clínicas, gere relatórios, consulte protocolos. Seu copiloto digital.",
  },
  {
    Icon: DollarSign,
    titulo: "Financeiro completo",
    descricao:
      "Receitas, despesas, comissões, recibos em PDF. Tudo num lugar só.",
  },
];

export default function Features() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[28px] font-semibold leading-tight text-slate-900 sm:text-[32px]">
            Tudo o que você precisa.{" "}
            <span className="text-[#0D9488]">Nada que você não precisa.</span>
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Funcionalidades pensadas para profissionais da saúde que querem
            simplicidade sem perder controle.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, titulo, descricao }) => (
            <article
              key={titulo}
              className="rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-[#99F6E4] hover:shadow-[0_4px_12px_rgba(13,148,136,0.08)]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#F0FDFA] text-[#0D9488]">
                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {descricao}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
