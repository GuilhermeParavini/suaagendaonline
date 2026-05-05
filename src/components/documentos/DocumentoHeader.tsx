interface DocumentoHeaderProps {
  titulo: string;
  tenantNome: string;
  endereco?: string | null;
  cidade?: string | null;
  logoUrl?: string | null;
}

function DocumentoHeader({
  titulo,
  tenantNome,
  endereco,
  cidade,
  logoUrl,
}: DocumentoHeaderProps) {
  return (
    <header className="border-b-2 border-primary pb-4">
      <div className="flex flex-col items-center text-center gap-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="max-h-14 w-auto object-contain"
          />
        ) : null}
        <h2 className="text-lg font-semibold uppercase tracking-wide text-slate-900">
          {titulo}
        </h2>
        <p className="text-sm text-slate-700">{tenantNome}</p>
        {endereco ? (
          <p className="text-xs text-slate-500">{endereco}</p>
        ) : null}
        {cidade ? <p className="text-xs text-slate-500">{cidade}</p> : null}
      </div>
    </header>
  );
}

export default DocumentoHeader;
