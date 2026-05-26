'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  getInfoPlano,
  getLimiteTranscricao,
  type Plano,
} from '@/lib/planos';

export type UsoTranscricao = {
  plano: Plano;
  nomePlano: string;
  limiteSegundos: number;
  usadoSegundos: number;
  percentual: number;
  excedeu: boolean;
  minutosUsados: number;
  minutosLimite: number;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function obterContexto(): Promise<
  | { ok: true; tenantId: string; profissionalId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessao expirada.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profissionais')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Profissional nao encontrado.' };
  return {
    ok: true,
    tenantId: data.tenant_id as string,
    profissionalId: data.id as string,
  };
}

function mesAnoAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

async function calcularUso(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<UsoTranscricao> {
  const { data: tenant } = await admin
    .from('tenants')
    .select('plano')
    .eq('id', tenantId)
    .maybeSingle();
  const plano = ((tenant?.plano as string | null) ?? 'trial') as Plano;
  const info = getInfoPlano(plano);

  const { data: rows } = await admin
    .from('uso_transcricao')
    .select('segundos_usados')
    .eq('tenant_id', tenantId)
    .eq('mes_ano', mesAnoAtual());

  const usadoSegundos = (rows ?? []).reduce(
    (acc, r) => acc + (Number(r.segundos_usados) || 0),
    0,
  );
  const limiteSegundos = info.limiteTranscricaoSegundos;
  const percentual =
    limiteSegundos > 0 ? Math.min(100, (usadoSegundos / limiteSegundos) * 100) : 0;
  const excedeu = limiteSegundos === 0 || usadoSegundos >= limiteSegundos;

  return {
    plano,
    nomePlano: info.nome,
    limiteSegundos,
    usadoSegundos,
    percentual,
    excedeu,
    minutosUsados: Math.floor(usadoSegundos / 60),
    minutosLimite: Math.floor(limiteSegundos / 60),
  };
}

export async function getUsoTranscricao(): Promise<Result<UsoTranscricao>> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  const data = await calcularUso(admin, ctx.tenantId);
  return { ok: true, data };
}

export type LimiteTranscricaoResult = {
  permitido: boolean;
  mensagem: string;
  uso: UsoTranscricao;
};

export async function verificarLimiteTranscricao(): Promise<
  Result<LimiteTranscricaoResult>
> {
  const ctx = await obterContexto();
  if (!ctx.ok) return ctx;
  const admin = createAdminClient();
  return verificarLimiteTranscricaoPorTenant(admin, ctx.tenantId);
}

export async function verificarLimiteTranscricaoPorTenant(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<Result<LimiteTranscricaoResult>> {
  const uso = await calcularUso(admin, tenantId);

  // Em v2 a transcricao esta inclusa em todos os planos pagos. Esta branch
  // so dispara para planos invalidos/sem limite (defensiva).
  if (uso.limiteSegundos === 0) {
    return {
      ok: true,
      data: {
        permitido: false,
        mensagem:
          'Transcrição de áudio indisponível no plano atual. Verifique a configuração da sua assinatura.',
        uso,
      },
    };
  }

  if (uso.usadoSegundos >= uso.limiteSegundos) {
    return {
      ok: true,
      data: {
        permitido: false,
        mensagem: `Você atingiu o limite de ${uso.minutosLimite} minutos de transcrição deste mês. O limite renova dia 1 do próximo mês.`,
        uso,
      },
    };
  }

  if (uso.percentual >= 80) {
    return {
      ok: true,
      data: {
        permitido: true,
        mensagem: `Você já usou ${uso.minutosUsados} de ${uso.minutosLimite} minutos de transcrição deste mês.`,
        uso,
      },
    };
  }

  return {
    ok: true,
    data: { permitido: true, mensagem: '', uso },
  };
}
