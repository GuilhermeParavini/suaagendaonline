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
  { Icon: Apple, nome: "Nutricao" },
  { Icon: Brain, nome: "Psicologia" },
  { Icon: MessagesSquare, nome: "Fonoaudiologia" },
  { Icon: HeartPulse, nome: "Cardiologia" },
  { Icon: Smile, nome: "Odontologia" },
  { Icon: Plus, nome: "E mais..." },
];

export default function Specialties() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[28px] font-semibold leading-tight text-slate-900 sm:text-[32px]">
            Feito para a sua especialidade
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Templates de anamnese prontos para cada area. Personalize como
            quiser.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {ESPECIALIDADES.map(({ Icon, nome }) => (
            <article
              key={nome}
              className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-center transition-all hover:border-[#99F6E4] hover:shadow-[0_4px_12px_rgba(13,148,136,0.08)]"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0FDFA] text-[#0D9488] transition-colors group-hover:bg-[#99F6E4]/60">
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {nome}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
