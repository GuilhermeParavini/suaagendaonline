import {
  Footprints,
  Activity,
  Apple,
  Brain,
  MessagesSquare,
  HeartPulse,
  Smile,
  Plus,
} from "lucide-react";

const ESPECIALIDADES = [
  { Icon: Footprints, nome: "Podologia" },
  { Icon: Activity, nome: "Fisioterapia" },
  { Icon: Apple, nome: "Nutrição" },
  { Icon: Brain, nome: "Psicologia" },
  { Icon: MessagesSquare, nome: "Fonoaudiologia" },
  { Icon: HeartPulse, nome: "Cardiologia" },
  { Icon: Smile, nome: "Odontologia" },
  { Icon: Plus, nome: "E mais..." },
];

export default function Specialties() {
  return (
    <section className="bg-slate-50 py-12 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[22px] font-semibold leading-tight text-slate-900 sm:text-[28px]">
            Feito para a sua especialidade
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:mt-4 sm:text-base">
            Templates de anamnese prontos para cada área. Personalize como
            quiser.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2 sm:mt-12 sm:gap-4 lg:grid-cols-4">
          {ESPECIALIDADES.map(({ Icon, nome }) => (
            <article
              key={nome}
              className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition-all hover:border-[#99F6E4] hover:shadow-[0_4px_12px_rgba(13,148,136,0.08)] sm:gap-3 sm:p-6"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0FDFA] text-[#0D9488] transition-colors group-hover:bg-[#99F6E4]/60 sm:h-12 sm:w-12">
                <Icon
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="sm:h-6 sm:w-6"
                />
              </span>
              <span className="text-xs font-semibold text-slate-900 sm:text-sm">
                {nome}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
