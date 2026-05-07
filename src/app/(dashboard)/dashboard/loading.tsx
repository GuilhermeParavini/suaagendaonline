import Skeleton from "@/components/ui/Skeleton";
import SkeletonCard from "@/components/ui/SkeletonCard";
import SkeletonMetricCard from "@/components/ui/SkeletonMetricCard";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Metric Cards 2x2 */}
      <section className="grid grid-cols-2 gap-3">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </section>

      {/* Cards de uso (transcricao, assistente) */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
          <Skeleton width="40%" height={14} />
          <Skeleton variant="rectangular" height={8} />
          <Skeleton width="60%" height={12} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
          <Skeleton width="40%" height={14} />
          <Skeleton variant="rectangular" height={8} />
          <Skeleton width="60%" height={12} />
        </div>
      </section>

      {/* Proximos agendamentos */}
      <section className="space-y-3">
        <Skeleton width={200} height={18} />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>

      {/* Avaliacoes */}
      <section className="space-y-3">
        <Skeleton width={120} height={18} />
        <div className="rounded-lg border border-slate-200 bg-white p-4 flex items-center gap-3">
          <Skeleton width={120} height={20} />
          <Skeleton width={80} height={14} />
        </div>
      </section>
    </div>
  );
}
