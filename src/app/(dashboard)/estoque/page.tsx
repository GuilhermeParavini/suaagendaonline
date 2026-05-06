import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getEstoque } from "@/actions/estoque";
import { listarProfissionaisAtivosTenant } from "@/actions/equipe";
import EstoqueClient from "@/components/estoque/EstoqueClient";

export const dynamic = "force-dynamic";

interface EstoquePageProps {
  searchParams: Promise<{ alerta?: string }>;
}

export default async function EstoquePage({ searchParams }: EstoquePageProps) {
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

  const sp = await searchParams;
  const alertaInicial = sp.alerta === "true";

  const [estoqueRes, profsRes] = await Promise.all([
    getEstoque({ apenasAlerta: alertaInicial }),
    role === "admin"
      ? listarProfissionaisAtivosTenant()
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  if (!estoqueRes.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {estoqueRes.error}
      </div>
    );
  }

  const profissionais = profsRes.ok
    ? profsRes.data.map((p) => ({ id: p.id, nome: p.nome }))
    : [];

  return (
    <EstoqueClient
      initialProdutos={estoqueRes.data}
      role={role}
      profissionais={profissionais}
      alertaInicial={alertaInicial}
    />
  );
}
