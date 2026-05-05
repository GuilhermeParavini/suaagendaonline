import {
  getAgendamentoPorToken,
} from "@/actions/agendamento-publico";
import {
  getDatasIndisponiveis,
  getDiasSemanaDisponiveis,
} from "@/lib/agendamento-publico";
import ReagendarFlow from "@/components/agendamento-publico/ReagendarFlow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function MensagemErro({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mx-auto max-w-md text-center pt-8 space-y-3">
      <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
      <p className="text-sm text-slate-600 leading-relaxed">{texto}</p>
      <p className="text-xs text-slate-500">
        Em caso de duvida, entre em contato diretamente com o profissional.
      </p>
    </div>
  );
}

export default async function ReagendarPublicoPage({ params }: PageProps) {
  const { token } = await params;

  const result = await getAgendamentoPorToken(token);
  if (!result.ok) {
    return (
      <MensagemErro
        titulo="Link expirado ou agendamento nao encontrado"
        texto="O link que voce recebeu nao e mais valido."
      />
    );
  }

  const ag = result.agendamento;

  if (ag.status === "cancelado") {
    return (
      <MensagemErro
        titulo="Agendamento cancelado"
        texto="Este agendamento foi cancelado e nao pode mais ser reagendado."
      />
    );
  }
  if (ag.status === "concluido") {
    return (
      <MensagemErro
        titulo="Consulta ja realizada"
        texto="Esta consulta ja foi concluida."
      />
    );
  }
  if (ag.jaReagendado) {
    return (
      <MensagemErro
        titulo="Agendamento ja reagendado"
        texto="Este agendamento ja foi reagendado anteriormente."
      />
    );
  }
  if (ag.expirado) {
    return (
      <MensagemErro
        titulo="Agendamento expirado"
        texto="A data deste agendamento ja passou. Faca um novo agendamento."
      />
    );
  }

  const diasSemanaDisponiveis = await getDiasSemanaDisponiveis(
    ag.profissional.id,
  );

  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setUTCDate(fim.getUTCDate() + 120);
  const datasIndisponiveis = await getDatasIndisponiveis(
    ag.tenantId,
    ag.profissional.id,
    isoDate(hoje),
    isoDate(fim),
  );

  return (
    <ReagendarFlow
      token={token}
      agendamento={ag}
      diasSemanaDisponiveis={diasSemanaDisponiveis}
      datasIndisponiveis={datasIndisponiveis}
    />
  );
}
