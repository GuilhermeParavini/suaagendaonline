import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReciboData } from "@/actions/financeiro";
import { formatCurrency, isoToBrDate, valorPorExtenso } from "@/lib/masks";
import ReciboPrint from "@/components/financeiro/ReciboPrint";

export const dynamic = "force-dynamic";

const FORMA_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  convenio: "Convênio",
  transferencia: "Transferência",
  outro: "Outro",
};

interface ReciboPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReciboPage({ params }: ReciboPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await getReciboData(id);
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  const { lancamento, profissional, tenant, pacienteEmail } = result.data;
  const dataReferencia = lancamento.data_pagamento ?? lancamento.data_lancamento;
  const dataPagamento = isoToBrDate(dataReferencia);
  const valorFormatado = formatCurrency(lancamento.valor);
  const valorExtenso = valorPorExtenso(lancamento.valor);
  const formaPagamento = lancamento.forma_pagamento
    ? FORMA_LABELS[lancamento.forma_pagamento] ?? lancamento.forma_pagamento
    : null;
  const cidade = [tenant.cidade, tenant.estado].filter(Boolean).join(" - ");

  return (
    <ReciboPrint
      id={lancamento.id}
      pacienteEmail={pacienteEmail}
      tenant={{
        nome_empresa: tenant.nome_empresa,
        endereco: tenant.endereco,
        cidade,
      }}
      profissional={profissional}
      paciente={lancamento.paciente}
      descricao={lancamento.descricao}
      valorFormatado={valorFormatado}
      valorExtenso={valorExtenso}
      dataPagamento={dataPagamento}
      formaPagamento={formaPagamento}
    />
  );
}
