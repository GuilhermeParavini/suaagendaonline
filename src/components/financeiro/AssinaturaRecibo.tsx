import { signatureFontClass } from "@/lib/signature-fonts";
import { cn } from "@/lib/utils";

interface AssinaturaReciboProps {
  nome: string;
  especialidade: string;
  registroProfissional: string | null;
  email: string;
  telefone: string | null;
  assinaturaTipo: "fonte" | "imagem" | null;
  assinaturaFonte: string | null;
  assinaturaUrl: string | null;
}

function AssinaturaRecibo({
  nome,
  especialidade,
  registroProfissional,
  email,
  telefone,
  assinaturaTipo,
  assinaturaFonte,
  assinaturaUrl,
}: AssinaturaReciboProps) {
  const temAssinatura =
    (assinaturaTipo === "fonte" && assinaturaFonte) ||
    (assinaturaTipo === "imagem" && assinaturaUrl);

  return (
    <section className="mt-12 text-center text-sm">
      {temAssinatura ? (
        <div className="mx-auto flex w-72 flex-col items-center">
          <div className="flex h-16 items-end justify-center">
            {assinaturaTipo === "fonte" ? (
              <p
                className={cn(
                  "text-[28px] leading-none text-slate-700",
                  signatureFontClass(assinaturaFonte),
                )}
              >
                {nome}
              </p>
            ) : assinaturaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assinaturaUrl}
                alt={`Assinatura de ${nome}`}
                className="max-h-[60px] object-contain"
              />
            ) : null}
          </div>

          <div className="mt-1 w-full border-t border-slate-400 pt-2">
            <p className="font-medium text-slate-900">{nome}</p>
            <p className="text-xs text-slate-600">
              {especialidade}
              {registroProfissional ? ` - ${registroProfissional}` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {email}
              {telefone ? ` - ${telefone}` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-72 border-t border-slate-400 pt-2">
          <p className="font-medium text-slate-900">{nome}</p>
          <p className="text-xs text-slate-600">
            {especialidade}
            {registroProfissional ? ` - ${registroProfissional}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {email}
            {telefone ? ` - ${telefone}` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

export default AssinaturaRecibo;
