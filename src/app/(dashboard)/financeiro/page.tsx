import { redirect } from "next/navigation";
import {
  getLancamentos,
  getResumoFinanceiro,
  listarPacientesOptions,
} from "@/actions/financeiro";
import { createClient } from "@/lib/supabase/server";
import FinanceiroClient from "@/components/financeiro/FinanceiroClient";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  const [resumoRes, lancamentosRes, pacientesRes] = await Promise.all([
    getResumoFinanceiro(mes, ano),
    getLancamentos({
      mes,
      ano,
      tipo: "receita",
      forma_pagamento: "todos",
      status: "todos",
    }),
    listarPacientesOptions(),
  ]);

  if (!resumoRes.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {resumoRes.error}
      </div>
    );
  }
  if (!lancamentosRes.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {lancamentosRes.error}
      </div>
    );
  }
  if (!pacientesRes.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {pacientesRes.error}
      </div>
    );
  }

  return (
    <FinanceiroClient
      initialMes={mes}
      initialAno={ano}
      initialResumo={resumoRes.data}
      initialLancamentos={lancamentosRes.data}
      pacientes={pacientesRes.data}
    />
  );
}
