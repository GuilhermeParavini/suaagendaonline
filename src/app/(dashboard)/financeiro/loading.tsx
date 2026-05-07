import Skeleton from "@/components/ui/Skeleton";
import SkeletonMetricCard from "@/components/ui/SkeletonMetricCard";

export default function FinanceiroLoading() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Skeleton width={120} height={22} />
        <Skeleton width={200} height={13} />
      </header>

      {/* 3 metric cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </section>

      {/* Toggle receita/despesa + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton variant="rectangular" width={180} height={36} />
        <Skeleton variant="rectangular" width={140} height={36} />
      </div>

      {/* Lista de lancamentos */}
      <ul className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3"
          >
            <Skeleton variant="circular" width={36} height={36} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={12} />
            </div>
            <Skeleton width={80} height={16} />
          </li>
        ))}
      </ul>
    </div>
  );
}
