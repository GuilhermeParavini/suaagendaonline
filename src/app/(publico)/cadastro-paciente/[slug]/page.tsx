import { notFound } from "next/navigation";
import { getProfissionalBySlug } from "@/lib/agendamento-publico";
import FormCadastroAvulso from "@/components/agendamento-publico/FormCadastroAvulso";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CadastroPacientePage({ params }: PageProps) {
  const { slug } = await params;

  const ctx = await getProfissionalBySlug(slug);
  if (!ctx.ok) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {ctx.data.profissional.especialidade}
        </p>
        <h1 className="text-xl font-semibold text-slate-900 leading-tight">
          {ctx.data.profissional.nome}
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed pt-2">
          Preencha seus dados para se cadastrar como paciente de{" "}
          {ctx.data.profissional.nome}.
        </p>
      </header>

      <FormCadastroAvulso
        slug={slug}
        profissionalNome={ctx.data.profissional.nome}
      />
    </div>
  );
}
