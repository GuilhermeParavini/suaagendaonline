import { notFound } from "next/navigation";
import {
  getDatasIndisponiveis,
  getDiasSemanaDisponiveis,
  getProfissionalBySlug,
} from "@/lib/agendamento-publico";
import AgendarFlow from "@/components/agendamento-publico/AgendarFlow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AgendarPublicoPage({ params }: PageProps) {
  const { slug } = await params;

  const ctx = await getProfissionalBySlug(slug);
  if (!ctx.ok) notFound();

  const diasSemanaDisponiveis = await getDiasSemanaDisponiveis(
    ctx.data.profissional.id,
  );

  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setUTCDate(fim.getUTCDate() + 120);
  const datasIndisponiveis = await getDatasIndisponiveis(
    ctx.data.tenantId,
    ctx.data.profissional.id,
    isoDate(hoje),
    isoDate(fim),
  );

  return (
    <AgendarFlow
      contexto={ctx.data}
      diasSemanaDisponiveis={diasSemanaDisponiveis}
      datasIndisponiveis={datasIndisponiveis}
    />
  );
}
