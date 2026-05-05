import { notFound } from "next/navigation";
import {
  getDatasIndisponiveis,
  getDiasSemanaDisponiveis,
  getProfissionaisAtivosBySlug,
  getProfissionalBySlug,
} from "@/lib/agendamento-publico";
import AgendarFlow from "@/components/agendamento-publico/AgendarFlow";
import EscolherProfissional from "@/components/agendamento-publico/EscolherProfissional";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ profissional?: string }>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AgendarPublicoPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { profissional: profissionalIdQuery } = await searchParams;

  const lista = await getProfissionaisAtivosBySlug(slug);
  if (!lista.ok) notFound();

  // >1 profissional ativo e nenhum selecionado → mostrar picker
  if (lista.profissionais.length > 1 && !profissionalIdQuery) {
    return (
      <EscolherProfissional
        slug={slug}
        tenantNome={lista.tenantNome}
        profissionais={lista.profissionais}
      />
    );
  }

  const profissionalIdAlvo =
    profissionalIdQuery ?? lista.profissionais[0]?.id;
  if (!profissionalIdAlvo) notFound();

  const ctx = await getProfissionalBySlug(slug, profissionalIdAlvo);
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
      slug={slug}
    />
  );
}
