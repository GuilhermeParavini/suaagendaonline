import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
}

function MetricCard({
  label,
  value,
  trend,
  className,
  ...props
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded bg-slate-100 px-4 py-3 flex flex-col gap-1",
        className,
      )}
      {...props}
    >
      <span className="text-xs font-normal text-slate-500 leading-tight">
        {label}
      </span>
      <span className="text-[24px] font-medium text-slate-900 leading-tight">
        {value}
      </span>
      {trend && (
        <span
          className={cn(
            "text-[11px] font-medium leading-tight",
            trend.direction === "up" ? "text-success" : "text-danger",
          )}
        >
          {trend.value}
        </span>
      )}
    </div>
  );
}

export default MetricCard;
