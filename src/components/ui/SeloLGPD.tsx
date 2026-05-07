import { Lock } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SeloLGPDProps = HTMLAttributes<HTMLDivElement>;

function SeloLGPD({ className, ...props }: SeloLGPDProps) {
  return (
    <div
      role="note"
      aria-label="Dados protegidos pela LGPD"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-[14px] font-medium text-teal-700 leading-none",
        className,
      )}
      {...props}
    >
      <Lock size={14} strokeWidth={1.5} aria-hidden="true" />
      <span>Dados protegidos pela LGPD</span>
    </div>
  );
}

export default SeloLGPD;
