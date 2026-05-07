import Skeleton from "./Skeleton";
import SkeletonCard from "./SkeletonCard";
import { cn } from "@/lib/utils";

interface SkeletonListProps {
  /** Quantos itens renderizar (default 5). */
  count?: number;
  /** `card` para cards de agendamento, `row` para linhas mais densas. */
  variant?: "card" | "row";
  className?: string;
}

/** Lista de skeletons empilhados (use enquanto a lista real carrega). */
function SkeletonList({
  count = 5,
  variant = "card",
  className,
}: SkeletonListProps) {
  return (
    <ul
      role="status"
      aria-label="Carregando lista"
      className={cn("space-y-2", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          {variant === "card" ? (
            <SkeletonCard />
          ) : (
            <SkeletonRow />
          )}
        </li>
      ))}
    </ul>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={12} />
      </div>
      <Skeleton variant="rectangular" width={72} height={28} />
    </div>
  );
}

export default SkeletonList;
