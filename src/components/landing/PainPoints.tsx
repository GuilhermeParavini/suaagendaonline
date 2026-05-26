import { CalendarX, Wallet, FileEdit } from "lucide-react";

const PAIN_POINTS = [
  {
    Icon: CalendarX,
    titulo: "Agenda desorganizada",
    descricao:
      "Pacientes ligam pra remarcar. Voce perde tempo anotando em papel ou WhatsApp.",
  },
  {
    Icon: Wallet,
    titulo: "Sistemas caros e complicados",
    descricao:
      "Paga R$ 100, R$ 200 por mes por funcoes que nunca usa. TISS, telemedicina... voce so precisa agendar e atender.",
  },
  {
    Icon: FileEdit,
    titulo: "Evolucoes demoradas",
    descricao:
      "Depois de cada atendimento, ainda precisa sentar e digitar tudo. Tempo que podia ser com o proximo paciente.",
  },
];

export default function PainPoints() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[28px] font-semibold leading-tight text-slate-900 sm:text-[32px]">
            Voce ainda usa agenda de papel? Ou paga caro por um sistema que nao
            usa metade?
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Os problemas que ouvimos de profissionais da saude todos os dias.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map(({ Icon, titulo, descricao }) => (
            <article
              key={titulo}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#FEF2F2] text-[#EF4444]">
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
