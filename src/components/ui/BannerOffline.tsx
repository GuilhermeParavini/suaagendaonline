"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Estado = "online" | "offline" | "voltou";

function BannerOffline() {
  const [estado, setEstado] = useState<Estado>("online");

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (typeof window === "undefined") return;

    if (!navigator.onLine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado("offline");
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onOffline = () => {
      if (timer) clearTimeout(timer);
      setEstado("offline");
    };
    const onOnline = () => {
      setEstado("voltou");
      timer = setTimeout(() => setEstado("online"), 3000);
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (estado === "online") return null;

  if (estado === "offline") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed top-0 inset-x-0 z-[55] flex items-center justify-center gap-2",
          "bg-amber-50 border-b border-amber-200 px-4 py-2 text-[13px] font-medium text-amber-800",
        )}
      >
        <WifiOff size={14} strokeWidth={1.5} aria-hidden="true" />
        Voce esta offline. Dados podem estar desatualizados.
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 inset-x-0 z-[55] flex items-center justify-center gap-2",
        "bg-[#F0FDFA] border-b border-[#CCFBF1] px-4 py-2 text-[13px] font-medium text-[#115E59]",
      )}
    >
      <Wifi size={14} strokeWidth={1.5} aria-hidden="true" />
      Conexao restaurada
    </div>
  );
}

export default BannerOffline;
