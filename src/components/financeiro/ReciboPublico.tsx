import AssinaturaRecibo from "./AssinaturaRecibo";

interface ReciboPublicoProps {
  tenant: {
    nome_empresa: string;
    endereco: string | null;
    cidade: string;
  };
  profissional: {
    nome: string;
    especialidade: string;
    registro_profissional: string | null;
    email: string;
    telefone: string | null;
    assinatura_tipo: "fonte" | "imagem" | null;
    assinatura_fonte: string | null;
    assinatura_url: string | null;
    logo_url: string | null;
  };
  paciente: { id: string; nome: string } | null;
  descricao: string;
  valorFormatado: string;
  valorExtenso: string;
  dataPagamento: string;
  formaPagamento: string | null;
}

function ReciboPublico({
  tenant,
  profissional,
  paciente,
  descricao,
  valorFormatado,
  valorExtenso,
  dataPagamento,
  formaPagamento,
}: ReciboPublicoProps) {
  return (
    <article className="mx-auto max-w-[680px] rounded-lg border border-slate-200 bg-white p-6 md:p-10 text-slate-900">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          {profissional.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profissional.logo_url}
              alt="Logo"
              className="max-h-12 w-auto shrink-0 object-contain"
            />
          ) : null}
          <div className="flex-1 text-center">
            <h2 className="text-lg font-semibold uppercase tracking-wide">
              Recibo de Pagamento
            </h2>
            <p className="mt-1 text-sm text-slate-600">{tenant.nome_empresa}</p>
            {tenant.endereco ? (
              <p className="text-xs text-slate-500">{tenant.endereco}</p>
            ) : null}
            {tenant.cidade ? (
              <p className="text-xs text-slate-500">{tenant.cidade}</p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mt-6 space-y-3 text-sm leading-relaxed">
        <p>
          Recebi de{" "}
          <span className="font-semibold">
            {paciente?.nome ?? "(não informado)"}
          </span>{" "}
          a importância de{" "}
          <span className="font-semibold">{valorFormatado}</span> (
          <span className="italic">{valorExtenso}</span>) referente a{" "}
          <span className="font-medium">{descricao}</span>
          {formaPagamento ? (
            <>
              , pago através de{" "}
              <span className="font-medium">{formaPagamento}</span>
            </>
          ) : null}
          .
        </p>
        <p>
          Para clareza firmo o presente recibo, dando plena, geral e
          irrevogável quitação do valor recebido.
        </p>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-6 text-xs text-slate-600">
        <div>
          <p className="font-medium text-slate-500">Data</p>
          <p className="mt-1 text-slate-900">{dataPagamento}</p>
        </div>
        <div>
          <p className="font-medium text-slate-500">Valor</p>
          <p className="mt-1 text-slate-900">{valorFormatado}</p>
        </div>
      </section>

      <AssinaturaRecibo
        nome={profissional.nome}
        especialidade={profissional.especialidade}
        registroProfissional={profissional.registro_profissional}
        email={profissional.email}
        telefone={profissional.telefone}
        assinaturaTipo={profissional.assinatura_tipo}
        assinaturaFonte={profissional.assinatura_fonte}
        assinaturaUrl={profissional.assinatura_url}
      />
    </article>
  );
}

export default ReciboPublico;
