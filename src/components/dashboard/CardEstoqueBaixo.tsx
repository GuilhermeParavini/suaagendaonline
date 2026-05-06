import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface CardEstoqueBaixoProps {
  contagem: number;
}

function CardEstoqueBaixo({ contagem }: CardEstoqueBaixoProps) {
  if (contagem <= 0) return null;
  return (
    <Link
      href="/estoque?alerta=true"
      className="block rounded-xl border border-red-200 bg-red-50 p-5 transition-colors hover:bg-red-100"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-200 text-red-700">
          <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-900">Estoque baixo</p>
          <p className="mt-0.5 text-xs text-red-800">
            {contagem === 1
              ? "1 produto abaixo do minimo"
              : `${contagem} produtos abaixo do minimo`}
          </p>
          <span className="mt-1 inline-block text-xs font-medium text-primary-dark">
            Ver estoque →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default CardEstoqueBaixo;
