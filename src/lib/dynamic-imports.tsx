"use client";

// Imports dinamicos centralizados.
// - `ssr: false` so e valido em client components, por isso este arquivo
//   tem o diretiva "use client" no topo.
// - O `loading` mostrado enquanto o chunk e baixado usa skeletons existentes.

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import SkeletonMetricCard from "@/components/ui/SkeletonMetricCard";

function LoadingRelatorios() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton variant="rectangular" width={140} height={38} />
        <Skeleton variant="rectangular" width={140} height={38} />
        <Skeleton variant="rectangular" width={120} height={38} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
        <SkeletonMetricCard />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <Skeleton width={160} height={16} />
        <Skeleton variant="rectangular" height={240} />
      </div>
    </div>
  );
}

function LoadingTela() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex items-center justify-center py-12"
    >
      <Loader2
        size={24}
        strokeWidth={1.5}
        aria-hidden="true"
        className="animate-spin text-primary-text"
      />
    </div>
  );
}

function LoadingModal() {
  // Modais sao montados apos clique do usuario; um spinner discreto
  // aparece por milisegundos enquanto o chunk baixa.
  return null;
}

// ---------------- Relatorios (Recharts e pesado, ~200 KB) ----------------

export const LazyRelatoriosClient = dynamic(
  () => import("@/components/relatorios/RelatoriosClient"),
  { ssr: false, loading: () => <LoadingRelatorios /> },
);

// ---------------- Modais ----------------

export const LazyNovoAgendamentoModal = dynamic(
  () => import("@/components/agenda/NovoAgendamentoModal"),
  { ssr: false, loading: LoadingModal },
);

export const LazyEditarPacienteModal = dynamic(
  () => import("@/components/pacientes/EditarPacienteModal"),
  { ssr: false, loading: LoadingModal },
);

export const LazyFormProduto = dynamic(
  () => import("@/components/estoque/FormProduto"),
  { ssr: false, loading: LoadingModal },
);

export const LazyModalMovimentacao = dynamic(
  () => import("@/components/estoque/ModalMovimentacao"),
  { ssr: false, loading: LoadingModal },
);

// ---------------- PDFs / Impressao ----------------

export const LazyReciboPrint = dynamic(
  () => import("@/components/financeiro/ReciboPrint"),
  { ssr: false, loading: () => <LoadingTela /> },
);

export const LazyRelatorioClinicoPrint = dynamic(
  () => import("@/components/documentos/RelatorioClinicoPrint"),
  { ssr: false, loading: () => <LoadingTela /> },
);

export const LazyAtestadoPrint = dynamic(
  () => import("@/components/documentos/AtestadoPrint"),
  { ssr: false, loading: () => <LoadingTela /> },
);

export const LazyPlanoCuidadosPrint = dynamic(
  () => import("@/components/documentos/PlanoCuidadosPrint"),
  { ssr: false, loading: () => <LoadingTela /> },
);

// ---------------- Rota publica ----------------

export const LazySeletorHorario = dynamic(
  () => import("@/components/agendamento-publico/SeletorHorario"),
  { ssr: false, loading: () => <LoadingTela /> },
);

export const LazyFormPacientePublico = dynamic(
  () => import("@/components/agendamento-publico/FormPacientePublico"),
  { ssr: false, loading: () => <LoadingTela /> },
);
