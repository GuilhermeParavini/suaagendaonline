import { CalendarX, Wallet, FileEdit } from "lucide-react";

const PAIN_POINTS = [
  {
    Icon: CalendarX,
    titulo: "Agenda desorganizada",
    descricao:
      "Pacientes ligam pra remarcar. Você perde tempo anotando em papel ou WhatsApp.",
  },
  {
    Icon: Wallet,
    titulo: "Sistemas caros e complicados",
    descricao:
      "Paga R$ 100, R$ 200 por mês por funções que nunca usa. TISS, telemedicina... você só precisa agendar e atender.",
  },
  {
    Icon: FileEdit,
    titulo: "Evoluções demoradas",
    descricao:
      "Depois de cada atendimento, ainda precisa sentar e digitar tudo. Tempo que podia ser com o próximo paciente.",
  },
];

export default function PainPoints() {
  return (
    <section className="bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[22px] font-semibold leading-tight text-slate-900 sm:text-[28px]">
            Você ainda usa agenda de papel? Ou paga caro por um sistema que não
            usa metade?
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:mt-4 sm:text-base">
            Os problemas que ouvimos de profissionais da saúde todos os dias.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {PAIN_POINTS.map(({ Icon, titulo, descricao }) => (
            <article
              key={titulo}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] sm:p-6"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#EF4444] sm:mb-4 sm:h-11 sm:w-11">
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="sm:h-[22px] sm:w-[22px]"
                />
              </div>
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                {titulo}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 sm:mt-2 sm:text-sm">
                {descricao}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
