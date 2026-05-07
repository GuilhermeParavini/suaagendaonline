import Skeleton from "@/components/ui/Skeleton";
import SkeletonMetricCard from "@/components/ui/SkeletonMetricCard";

export default function EstoqueLoading() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Skeleton width={100} height={22} />
          <Skeleton width={180} height={13} />
        </div>
        <Skeleton variant="rectangular" width={140} height={36} />
      </header>

      {/* Metricas resumo */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </section>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton variant="rectangular" width={220} height={38} />
        <Skeleton variant="rectangular" width={140} height={38} />
      </div>

      {/* Lista de produtos */}
      <ul className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton width="50%" height={16} />
              <Skeleton width={64} height={20} className="rounded-full" />
            </div>
            <Skeleton width="35%" height={12} />
            <div className="flex gap-3 pt-1">
              <Skeleton width={80} height={12} />
              <Skeleton width={80} height={12} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
