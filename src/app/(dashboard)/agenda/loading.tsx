import Skeleton from "@/components/ui/Skeleton";
import SkeletonCard from "@/components/ui/SkeletonCard";

export default function AgendaLoading() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Skeleton width={80} height={22} />
          <Skeleton width={140} height={13} />
        </div>
        <Skeleton variant="rectangular" width={120} height={36} />
      </header>

      {/* Toggle dia/semana/mes */}
      <Skeleton variant="rectangular" width={220} height={36} />

      {/* Calendario semanal (faixa de 7 dias) */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 rounded p-2"
          >
            <Skeleton width={24} height={11} />
            <Skeleton variant="circular" width={32} height={32} />
          </div>
        ))}
      </div>

      {/* Lista de horarios */}
      <div className="space-y-2">
        <Skeleton width={140} height={14} />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
