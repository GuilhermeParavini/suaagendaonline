import { notFound } from "next/navigation";
import {
  getDiasSemanaDisponiveis,
  getProfissionalBySlug,
} from "@/lib/agendamento-publico";
import AgendarFlow from "@/components/agendamento-publico/AgendarFlow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AgendarPublicoPage({ params }: PageProps) {
  const { slug } = await params;

  const ctx = await getProfissionalBySlug(slug);
  if (!ctx.ok) notFound();

  const diasSemanaDisponiveis = await getDiasSemanaDisponiveis(
    ctx.data.profissional.id,
  );

  return (
    <AgendarFlow
      contexto={ctx.data}
      diasSemanaDisponiveis={diasSemanaDisponiveis}
    />
  );
}
