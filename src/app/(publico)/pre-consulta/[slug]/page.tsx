import { notFound } from "next/navigation";
import { getProfissionalBySlug } from "@/lib/agendamento-publico";
import PreConsultaFlow from "@/components/agendamento-publico/PreConsultaFlow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PreConsultaPage({ params }: PageProps) {
  const { slug } = await params;

  const ctx = await getProfissionalBySlug(slug);
  if (!ctx.ok) notFound();

  return (
    <PreConsultaFlow
      slug={slug}
      profissionalNome={ctx.data.profissional.nome}
      profissionalEspecialidade={ctx.data.profissional.especialidade}
      logoUrl={ctx.data.profissional.logo_url}
    />
  );
}
