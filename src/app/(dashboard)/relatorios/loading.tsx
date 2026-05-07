import Skeleton from "@/components/ui/Skeleton";
import SkeletonMetricCard from "@/components/ui/SkeletonMetricCard";

export default function RelatoriosLoading() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Skeleton width={120} height={22} />
        <Skeleton width={220} height={13} />
      </header>

      {/* Filtros de periodo */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton variant="rectangular" width={140} height={38} />
        <Skeleton variant="rectangular" width={140} height={38} />
        <Skeleton variant="rectangular" width={120} height={38} />
      </div>

      {/* Metric cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </section>

      {/* Grafico principal */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <Skeleton width={160} height={16} />
        <Skeleton variant="rectangular" height={240} />
      </section>

      {/* Tabela */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <Skeleton width={140} height={16} />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton width="40%" height={14} />
              <Skeleton width="20%" height={14} />
              <Skeleton width="20%" height={14} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
