'use server';

import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { seedFeriadosNacionais } from '@/actions/feriados';
import { seedTemplatesAnamnese } from '@/actions/anamnese';

// Função auxiliar para gerar slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remove acentos
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-') // Remove hífens múltiplos
    .trim();
}

export async function completeOnboarding(data: {
  fullName: string;
  specialty: string;
  professionalRegistry?: string;
  phone: string;
  companyName: string;
  companyPhone?: string;
  city: string;
  state: string;
  tipoAtendimento?: string;
}) {
  try {
    // Autenticacao: ler a sessao dos cookies via server client (mesma fonte de
    // verdade que o proxy valida).
    const authClient = await createClient();

    // 1a tentativa: ler o usuario da sessao (cookies).
    const primeira = await authClient.auth.getUser();
    let user = primeira.data.user;

    // Se nao houver usuario, tentar refrescar a sessao ANTES de desistir. O token
    // de acesso pode ter expirado enquanto o usuario preenchia o onboarding; o
    // refresh token (ainda nos cookies) permite renovar a sessao sem novo login.
    if (!user) {
      const refresh = await authClient.auth.refreshSession();
      user = refresh.data.user;

      if (!user) {
        return {
          success: false,
          error: 'Sessão expirada. Por favor, faça login novamente.',
        };
      }
    }

    // A partir daqui `user` e garantidamente nao-nulo.
    const userId = user.id;
    const email = user.email!;

    // Validar env var necessaria ao admin client (service role).
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceRoleKey) {
      console.error('Variáveis de ambiente Supabase ausentes');
      return { success: false, error: 'Configuração do servidor inválida.' };
    }

    // Service role para bypass de RLS nas escritas de banco.
    const supabase = createAdminClient();

    // Verificar se usuário já tem profissional/tenant
    const { data: existingProf } = await supabase
      .from('profissionais')
      .select('id, tenant_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingProf) {
      return { success: true, error: null };
    }

    // Gerar slug único
    let slug = generateSlug(data.companyName);
    const baseSlug = slug;
    let counter = 1;

    // Verificar se slug já existe
    while (true) {
      const { data: existing, error: checkError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar slug:', checkError.message);
      }

      if (!existing) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Criar tenant — inicia em trial de 14 dias.
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        nome_empresa: data.companyName,
        slug,
        plano: 'trial',
        status_assinatura: 'trial',
        // max_profissionais reflete o plano contratado; controle real do limite
        // fica em src/lib/planos.ts via getMaxProfissionais.
        max_profissionais: 1,
        trial_expira_em: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        telefone: data.companyPhone,
        cidade: data.city,
        estado: data.state,
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      console.error('Erro ao criar tenant:', tenantError?.message);
      return {
        success: false,
        error: `Falha ao criar empresa: ${tenantError?.message ?? 'erro desconhecido'}`,
      };
    }

    // Criar profissional
    const { error: profissionalError } = await supabase
      .from('profissionais')
      .insert({
        tenant_id: tenant.id,
        user_id: userId,
        nome: data.fullName,
        especialidade: data.specialty,
        registro_profissional: data.professionalRegistry || null,
        email,
        telefone: data.phone,
        role: 'admin',
        ativo: true,
      });

    if (profissionalError) {
      console.error('Erro ao criar profissional:', profissionalError.message);
      // Deletar tenant criado se falhar ao criar profissional
      await supabase.from('tenants').delete().eq('id', tenant.id);
      if (profissionalError.code === '23505') {
        return {
          success: false,
          error: 'Este usuário já possui um cadastro. Faça login.',
        };
      }
      return {
        success: false,
        error: `Falha ao criar perfil profissional: ${profissionalError.message ?? 'erro desconhecido'}`,
      };
    }

    // tipo_atendimento e melhor-esforco: a coluna pode ainda nao existir no
    // banco. Para NUNCA derrubar o onboarding, gravamos via update separado e,
    // se falhar (coluna inexistente), apenas logamos um aviso e seguimos.
    if (data.tipoAtendimento) {
      const { error: tipoError } = await supabase
        .from('profissionais')
        .update({ tipo_atendimento: data.tipoAtendimento })
        .eq('user_id', userId);
      if (tipoError) {
        console.warn(
          'Nao foi possivel salvar tipo_atendimento (rode a migration da coluna):',
          tipoError.message,
        );
      }
    }

    // Seed de feriados nacionais (nao bloqueia o onboarding em caso de falha).
    try {
      const anoAtual = new Date().getFullYear();
      await seedFeriadosNacionais(anoAtual);
      await seedFeriadosNacionais(anoAtual + 1);
    } catch (seedErr) {
      console.error(
        'Falha ao popular feriados nacionais:',
        seedErr instanceof Error ? seedErr.message : seedErr,
      );
    }

    // Buscar profissional recem-criado para pegar o id
    const { data: profCriado } = await supabase
      .from('profissionais')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    // Seed de template padrao de anamnese (nao bloqueia o onboarding em caso de falha).
    if (profCriado?.id) {
      try {
        await seedTemplatesAnamnese(
          profCriado.id as string,
          tenant.id as string,
          data.specialty,
        );
      } catch (seedErr) {
        console.error(
          'Falha ao popular template de anamnese:',
          seedErr instanceof Error ? seedErr.message : seedErr,
        );
      }
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro em completeOnboarding:', error);
    return { success: false, error: 'Erro ao processar solicitação. Tente novamente.' };
  }
}

// Usado pela pagina de /onboarding para evitar que um usuario que JA concluiu o
// cadastro veja o onboarding novamente. getUser vem do client com sessao
// (cookies); a checagem de perfil usa o ADMIN client (service role, sem RLS) —
// MESMA estrategia do proxy, para decisao consistente e sem depender de
// auth.uid() server-side (que estava retornando NULL e quebrando o gate).
export async function usuarioTemPerfilProfissional(): Promise<boolean> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return false;

  const admin = createAdminClient();
  const { data: perfil, error } = await admin
    .from('profissionais')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    console.error(
      'Erro ao verificar perfil profissional:',
      error.message,
    );
    return false;
  }
  return !!perfil;
}

// Encerra a sessao do usuario: signOut limpa os cookies de sessao (via o client
// server-side) e em seguida redireciona para /login. redirect() e chamado fora
// de try/catch para o NEXT_REDIRECT propagar corretamente.
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
