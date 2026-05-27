import { UserPlus, Settings2, CalendarCheck } from "lucide-react";

const PASSOS = [
  {
    n: "1",
    Icon: UserPlus,
    titulo: "Crie sua conta",
    descricao: "Preencha nome, e-mail e especialidade. Sem cartão.",
  },
  {
    n: "2",
    Icon: Settings2,
    titulo: "Configure sua agenda",
    descricao:
      "Defina horários, serviços e bloqueios. O sistema já sugere templates da sua área.",
  },
  {
    n: "3",
    Icon: CalendarCheck,
    titulo: "Comece a atender",
    descricao:
      "Compartilhe seu link de agendamento e receba pacientes.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[22px] font-semibold leading-tight text-slate-900 sm:text-[28px]">
            Comece em <span className="text-[#0D9488]">3 minutos</span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:mt-4 sm:text-base">
            Sem instalação. Sem treinamento. Funciona no celular e no
            computador.
          </p>
        </div>

        <ol className="mt-8 grid gap-3 sm:mt-14 sm:grid-cols-3 sm:gap-6">
          {PASSOS.map(({ n, Icon, titulo, descricao }) => (
            <li
              key={n}
              className="relative rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
            >
              <span className="absolute -top-3 left-5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0D9488] text-[11px] font-semibold text-white sm:left-7 sm:h-7 sm:w-7 sm:text-xs">
                {n}
              </span>
              <Icon
                size={22}
                strokeWidth={1.5}
                className="text-[#0D9488] sm:h-7 sm:w-7"
                aria-hidden="true"
              />
              <h3 className="mt-3 text-base font-semibold text-slate-900 sm:mt-4 sm:text-lg">
                {titulo}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 sm:mt-2 sm:text-sm">
                {descricao}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
