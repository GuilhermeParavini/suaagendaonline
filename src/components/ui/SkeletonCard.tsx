import Skeleton from "./Skeleton";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
}

/**
 * Esqueleto de um card de agendamento: avatar circular + 2 linhas de texto + pill.
 */
function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-label="Carregando..."
      className={cn(
        "flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3",
        className,
      )}
    >
      <div className="flex w-12 shrink-0 flex-col items-center gap-1">
        <Skeleton width={32} height={14} />
        <Skeleton width={28} height={10} />
      </div>
      <Skeleton variant="circular" width={36} height={36} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </div>
      <Skeleton variant="rectangular" width={72} height={20} className="rounded-full" />
    </div>
  );
}

export default SkeletonCard;
