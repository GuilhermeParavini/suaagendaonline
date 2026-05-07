import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getContextoAvaliacao } from "@/actions/avaliacoes";
import FormAvaliacao from "@/components/agendamento-publico/FormAvaliacao";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nota?: string }>;
}

function parseNota(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 1 || n > 5) return 0;
  return Math.round(n);
}

export default async function AvaliacaoPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const initialNota = parseNota(sp.nota);

  const ctx = await getContextoAvaliacao(id);
  if (!ctx.ok) notFound();

  if (ctx.data.jaAvaliou) {
    return (
      <div className="space-y-6 text-center pt-6">
        {ctx.data.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ctx.data.logoUrl}
            alt="Logo"
            className="mx-auto max-h-[60px] w-auto object-contain"
          />
        ) : null}
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-surface">
          <Check
            size={32}
            strokeWidth={2.5}
            className="text-primary-text"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-slate-900">
            Você já avaliou esta consulta.
          </h1>
          <p className="text-sm text-slate-600">Obrigado.</p>
        </div>
      </div>
    );
  }

  return (
    <FormAvaliacao
      agendamentoId={ctx.data.agendamentoId}
      profissionalNome={ctx.data.profissionalNome}
      profissionalEspecialidade={ctx.data.profissionalEspecialidade}
      logoUrl={ctx.data.logoUrl}
      initialNota={initialNota}
    />
  );
}
