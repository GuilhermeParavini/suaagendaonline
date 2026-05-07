import Skeleton from "@/components/ui/Skeleton";
import SkeletonCard from "@/components/ui/SkeletonCard";

export default function HomeLoading() {
  return (
    <div className="space-y-6 pb-12">
      <header className="space-y-1">
        <Skeleton width={80} height={14} />
        <Skeleton width={180} height={22} />
      </header>

      {/* Card "proximo paciente" */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between">
          <Skeleton width={120} height={12} />
          <Skeleton width={80} height={20} className="rounded-full" />
        </div>
        <div className="flex items-start gap-3">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton width="55%" height={18} />
            <Skeleton width="40%" height={14} />
            <Skeleton width="35%" height={12} />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Skeleton variant="rectangular" width={120} height={40} />
          <Skeleton variant="rectangular" width={170} height={40} />
        </div>
      </section>

      {/* Lista do dia */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton width={60} height={18} />
          <Skeleton width={100} height={13} />
        </div>
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    </div>
  );
}
