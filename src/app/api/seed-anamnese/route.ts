import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { seedTemplatesAnamnese } from '@/actions/anamnese';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();

  if (!userResp.user) {
    return NextResponse.json(
      { sucesso: false, error: 'Nao autenticado' },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data: prof, error: profErr } = await admin
    .from('profissionais')
    .select('id, tenant_id, especialidade')
    .eq('user_id', userResp.user.id)
    .maybeSingle();

  if (profErr) {
    return NextResponse.json(
      { sucesso: false, error: profErr.message },
      { status: 500 },
    );
  }
  if (!prof) {
    return NextResponse.json(
      { sucesso: false, error: 'Profissional nao encontrado.' },
      { status: 404 },
    );
  }

  try {
    const r = await seedTemplatesAnamnese(
      prof.id as string,
      prof.tenant_id as string,
      prof.especialidade as string,
    );
    return NextResponse.json({
      sucesso: true,
      inserido: r.inserido,
      templateId: r.templateId,
      nome: r.nome,
      especialidade: prof.especialidade,
    });
  } catch (err) {
    return NextResponse.json(
      {
        sucesso: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
