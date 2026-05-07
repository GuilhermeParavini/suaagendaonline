import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { DadosAssinaturaEmail } from "@/lib/email-templates";

/**
 * Busca dados do tenant + profissional principal para compor a assinatura
 * personalizada nos emails. Retorna null em caso de erro/dados ausentes —
 * `gerarAssinaturaEmail` no template usa o fallback "Enviado via Sua Agenda
 * Online".
 *
 * Se `profissionalId` for omitido, escolhe o profissional dono (menor
 * created_at) para popular nome/especialidade. Em emails enviados a
 * pacientes, idealmente o caller passa o profissional do agendamento.
 */
export async function getTenantEmailSignature(
  tenantId: string,
  profissionalId?: string | null,
): Promise<DadosAssinaturaEmail | null> {
  if (!tenantId) return null;
  const admin = createAdminClient();

  try {
    const [{ data: tenant }, profRes] = await Promise.all([
      admin
        .from("tenants")
        .select("nome_empresa, slug, telefone, endereco, cidade, estado")
        .eq("id", tenantId)
        .maybeSingle(),
      profissionalId
        ? admin
            .from("profissionais")
            .select("nome, especialidade, telefone, logo_url")
            .eq("id", profissionalId)
            .maybeSingle()
        : admin
            .from("profissionais")
            .select("nome, especialidade, telefone, logo_url")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
    ]);

    if (!tenant) return null;

    const prof = profRes.data;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const slug = (tenant.slug as string | null) ?? null;
    const linkAgendamento =
      appUrl && slug ? `${appUrl.replace(/\/+$/, "")}/agendar/${slug}` : null;

    return {
      nomeEmpresa: (tenant.nome_empresa as string) ?? "Sua clinica",
      nomeProfissional: (prof?.nome as string | null) ?? null,
      especialidade: (prof?.especialidade as string | null) ?? null,
      telefone:
        (prof?.telefone as string | null) ??
        (tenant.telefone as string | null) ??
        null,
      endereco: (tenant.endereco as string | null) ?? null,
      cidade: (tenant.cidade as string | null) ?? null,
      estado: (tenant.estado as string | null) ?? null,
      logoUrl: (prof?.logo_url as string | null) ?? null,
      linkAgendamento,
    };
  } catch (e) {
    console.error("[tenant-email-signature]:", e);
    return null;
  }
}
