import Skeleton from "@/components/ui/Skeleton";
import SkeletonCard from "@/components/ui/SkeletonCard";

export default function PacientesLoading() {
  return (
    <div className="space-y-4 pb-20">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton width={120} height={22} />
          <Skeleton variant="rectangular" width={100} height={36} />
        </div>

        {/* Busca */}
        <Skeleton variant="rectangular" height={42} />

        {/* Filtros */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Skeleton variant="rectangular" height={38} />
          <Skeleton variant="rectangular" height={38} />
        </div>
      </header>

      <ul className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <SkeletonCard />
          </li>
        ))}
      </ul>
    </div>
  );
}
