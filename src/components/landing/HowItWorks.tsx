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
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[28px] font-semibold leading-tight text-slate-900 sm:text-[32px]">
            Comece em <span className="text-[#0D9488]">3 minutos</span>
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Sem instalação. Sem treinamento. Funciona no celular e no
            computador.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 sm:grid-cols-3">
          {PASSOS.map(({ n, Icon, titulo, descricao }) => (
            <li
              key={n}
              className="relative rounded-2xl border border-slate-200 bg-white p-7"
            >
              <span className="absolute -top-3 left-7 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0D9488] text-xs font-semibold text-white">
                {n}
              </span>
              <Icon
                size={28}
                strokeWidth={1.5}
                className="text-[#0D9488]"
                aria-hidden="true"
              />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {descricao}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
