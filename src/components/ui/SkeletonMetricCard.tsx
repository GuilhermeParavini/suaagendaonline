import Skeleton from "./Skeleton";

/** Esqueleto do MetricCard usado no dashboard de metricas. */
function SkeletonMetricCard() {
  return (
    <div
      role="status"
      aria-label="Carregando metrica"
      className="rounded bg-slate-100 px-4 py-3 flex flex-col gap-2"
    >
      <Skeleton width="50%" height={11} />
      <Skeleton width="40%" height={22} />
    </div>
  );
}

export default SkeletonMetricCard;
