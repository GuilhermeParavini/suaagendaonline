import { redirect } from "next/navigation";
import {
  getLancamentos,
  getResumoFinanceiro,
  listarPacientesOptions,
} from "@/actions/financeiro";
import { getComissoesTenant } from "@/actions/comissoes";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import FinanceiroClient from "@/components/financeiro/FinanceiroClient";
import PullToRefresh from "@/components/ui/PullToRefresh";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profissionais")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role =
    (prof?.role as "admin" | "profissional" | "secretaria" | null) ??
    "profissional";

  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  const [resumoRes, lancamentosRes, pacientesRes, comissoesRes] =
    await Promise.all([
      getResumoFinanceiro(mes, ano),
      getLancamentos({
        mes,
        ano,
        tipo: "receita",
        forma_pagamento: "todos",
        status: "todos",
      }),
      listarPacientesOptions(),
      role === "admin"
        ? getComissoesTenant()
        : Promise.resolve({ ok: true as const, data: [] }),
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

  const totalComissoesAtivas = comissoesRes.ok
    ? comissoesRes.data.filter((c) => c.ativo).length
    : 0;

  return (
    <PullToRefresh>
      <FinanceiroClient
        initialMes={mes}
        initialAno={ano}
        initialResumo={resumoRes.data}
        initialLancamentos={lancamentosRes.data}
        pacientes={pacientesRes.data}
        role={role}
        totalComissoesAtivas={totalComissoesAtivas}
      />
    </PullToRefresh>
  );
}
