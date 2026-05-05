import Link from "next/link";
import { Clock } from "lucide-react";

interface CardListaEsperaProps {
  contagem: number;
}

function CardListaEspera({ contagem }: CardListaEsperaProps) {
  if (contagem <= 0) return null;
  return (
    <Link
      href="/lista-espera"
      className="block rounded-xl border border-amber-200 bg-amber-50 p-5 transition-colors hover:bg-amber-100"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-700">
          <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Lista de espera
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            {contagem === 1
              ? "1 paciente aguardando"
              : `${contagem} pacientes aguardando`}
          </p>
          <span className="mt-1 inline-block text-xs font-medium text-primary-dark">
            Ver lista →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default CardListaEspera;
