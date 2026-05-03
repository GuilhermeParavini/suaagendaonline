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
      <header className="text-center border-b border-slate-200 pb-4">
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
      </header>

      <section className="mt-6 space-y-3 text-sm leading-relaxed">
        <p>
          Recebi de{" "}
          <span className="font-semibold">
            {paciente?.nome ?? "(nao informado)"}
          </span>{" "}
          a importancia de{" "}
          <span className="font-semibold">{valorFormatado}</span> (
          <span className="italic">{valorExtenso}</span>) referente a{" "}
          <span className="font-medium">{descricao}</span>
          {formaPagamento ? (
            <>
              , pago atraves de{" "}
              <span className="font-medium">{formaPagamento}</span>
            </>
          ) : null}
          .
        </p>
        <p>
          Para clareza firmo o presente recibo, dando plena, geral e
          irrevogavel quitacao do valor recebido.
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

      <section className="mt-12 text-center text-sm">
        <div className="mx-auto w-72 border-t border-slate-400 pt-2">
          <p className="font-medium">{profissional.nome}</p>
          <p className="text-xs text-slate-600">
            {profissional.especialidade}
            {profissional.registro_profissional
              ? ` - ${profissional.registro_profissional}`
              : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {profissional.email}
            {profissional.telefone ? ` - ${profissional.telefone}` : ""}
          </p>
        </div>
      </section>
    </article>
  );
}

export default ReciboPublico;
