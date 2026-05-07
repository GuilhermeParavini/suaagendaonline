"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: ReactNode;
  /**
   * Callback opcional. Se nao informado, faz `router.refresh()` apenas — util
   * para revalidar Server Components.
   */
  onRefresh?: () => Promise<void> | void;
  /** Permite desativar o gesto em telas que conflitam com swipe horizontal. */
  desabilitado?: boolean;
}

function PullToRefresh({
  children,
  onRefresh,
  desabilitado,
}: PullToRefreshProps) {
  const router = useRouter();
  const [refreshingViaRouter, setRefreshingViaRouter] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
      return;
    }
    setRefreshingViaRouter(true);
    try {
      router.refresh();
      // Damos um respiro para o servidor responder antes de soltar a UI.
      await new Promise((resolve) => setTimeout(resolve, 600));
    } finally {
      setRefreshingViaRouter(false);
    }
  }, [onRefresh, router]);

  const { estado, pull, progresso } = usePullToRefresh({
    onRefresh: handleRefresh,
    desabilitado,
  });

  const visivel = estado !== "idle" || refreshingViaRouter || pull > 0;
  const refreshando =
    estado === "refreshing" || refreshingViaRouter;

  return (
    <>
      <div
        aria-hidden={!visivel}
        className={cn(
          "lg:hidden pointer-events-none fixed left-0 right-0 z-40 flex justify-center transition-opacity",
          visivel ? "opacity-100" : "opacity-0",
        )}
        style={{
          top: 56, // logo abaixo do header
        }}
      >
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-primary-surface shadow-md transition-transform",
            "h-10 w-10",
          )}
          style={{
            transform: `translateY(${Math.max(0, pull - 12)}px) rotate(${
              progresso * 360
            }deg)`,
            transitionDuration: estado === "pulling" ? "0ms" : "200ms",
          }}
        >
          <RefreshCw
            size={18}
            strokeWidth={2}
            aria-hidden="true"
            className={cn(
              "text-primary-text",
              refreshando && "animate-spin",
            )}
          />
        </div>
      </div>
      {children}
    </>
  );
}

export default PullToRefresh;
