import { getReciboPublico } from "@/actions/financeiro";
import { formatCurrency, isoToBrDate, valorPorExtenso } from "@/lib/masks";
import ReciboPublico from "@/components/financeiro/ReciboPublico";

export const dynamic = "force-dynamic";

const FORMA_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartao de Credito",
  cartao_debito: "Cartao de Debito",
  convenio: "Convenio",
  transferencia: "Transferencia",
  outro: "Outro",
};

interface ReciboPublicoPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReciboPublicoPage({
  params,
}: ReciboPublicoPageProps) {
  const { id } = await params;
  const result = await getReciboPublico(id);
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  const { lancamento, profissional, tenant } = result.data;
  const dataReferencia =
    lancamento.data_pagamento ?? lancamento.data_lancamento;
  const dataPagamento = isoToBrDate(dataReferencia);
  const valorFormatado = formatCurrency(lancamento.valor);
  const valorExtenso = valorPorExtenso(lancamento.valor);
  const formaPagamento = lancamento.forma_pagamento
    ? FORMA_LABELS[lancamento.forma_pagamento] ?? lancamento.forma_pagamento
    : null;
  const cidade = [tenant.cidade, tenant.estado].filter(Boolean).join(" - ");

  return (
    <ReciboPublico
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
