'use server';

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { seedFeriadosNacionais } from '@/actions/feriados';
import { seedTemplatesAnamnese } from '@/actions/anamnese';
import { hasProfessionalProfile } from '@/actions/tenant';

// Função auxiliar para gerar slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
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
}) {
  try {
    console.log('=== Iniciando completeOnboarding ===');
    console.log('[completeOnboarding] recebendo:', JSON.stringify(data));

    // Autenticacao: ler a sessao dos cookies AGORA (no momento da chamada da
    // server action), via server client. Esta e a fonte de verdade confiavel —
    // os mesmos cookies que o proxy ja valida. Nao confiar em userId vindo do
    // cliente (browser getUser e fragil e estava retornando vazio no passo 2).
    const authClient = await createClient();
    console.log('[completeOnboarding] inicio');

    // 1a tentativa: ler o usuario da sessao (cookies).
    const primeira = await authClient.auth.getUser();
    console.log(
      '[completeOnboarding] getUser result:',
      JSON.stringify({
        user: !!primeira.data.user,
        error: primeira.error?.message ?? null,
      }),
    );

    let user = primeira.data.user;

    // Se nao houver usuario, tentar refrescar a sessao ANTES de desistir. O token
    // de acesso pode ter expirado enquanto o usuario preenchia o onboarding; o
    // refresh token (ainda nos cookies) permite renovar a sessao sem novo login.
    if (!user) {
      console.warn(
        '[completeOnboarding] getUser sem usuario — tentando refreshSession',
      );
      const refresh = await authClient.auth.refreshSession();
      console.log(
        '[completeOnboarding] refreshSession result:',
        JSON.stringify({
          user: !!refresh.data.user,
          session: !!refresh.data.session,
          error: refresh.error?.message ?? null,
        }),
      );
      user = refresh.data.user;

      if (!user) {
        console.error(
          '[completeOnboarding] sessao expirada — getUser E refreshSession falharam:',
          {
            getUserError: primeira.error?.message ?? 'sem usuario na sessao',
            refreshError: refresh.error?.message ?? 'sem sessao para refrescar',
          },
        );
        return {
          success: false,
          error: 'Sessão expirada. Por favor, faça login novamente.',
        };
      }
    }

    // A partir daqui `user` e garantidamente nao-nulo.
    const userId = user.id;
    const email = user.email!;

    console.log('[completeOnboarding] inicio', { temUser: true, userId });
    console.log('Dados recebidos:', {
      userId,
      email,
      fullName: data.fullName,
      specialty: data.specialty,
      phone: data.phone,
      companyName: data.companyName,
      city: data.city,
      state: data.state,
    });

    // Validar env var necessaria ao admin client (service role).
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceRoleKey) {
      console.error('❌ Variáveis de ambiente Supabase ausentes');
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
      console.log('⚠️ Usuário já possui cadastro completo. Tenant:', existingProf.tenant_id);
      return { success: true, error: null };
    }

    // Gerar slug único
    let slug = generateSlug(data.companyName);
    let baseSlug = slug;
    let counter = 1;

    console.log('Slug inicial gerado:', slug);

    // Verificar se slug já existe
    while (true) {
      const { data: existing, error: checkError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar slug:', checkError);
      }

      if (!existing) {
        console.log('Slug final (único):', slug);
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
      console.log('Slug já existe, tentando:', slug);
    }

    // Criar tenant
    console.log('[completeOnboarding] criando tenant para user:', userId);
    console.log('Criando tenant com dados:', {
      nome_empresa: data.companyName,
      slug,
      plano: 'trial',
      cidade: data.city,
      estado: data.state,
    });

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
        trial_expira_em: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        telefone: data.companyPhone,
        cidade: data.city,
        estado: data.state,
      })
      .select()
      .single();

    console.log('[completeOnboarding] resultado tenant:', { tenant, tenantError });

    if (tenantError || !tenant) {
      console.error('❌ Erro ao criar tenant:');
      console.error('  Código:', tenantError?.code);
      console.error('  Mensagem:', tenantError?.message);
      console.error('  Detalhes:', tenantError?.details);
      console.error('  Hint:', tenantError?.hint);
      console.error('  Erro completo (JSON):', JSON.stringify(tenantError, null, 2));
      console.error('  Tenant retornado:', tenant);
      return {
        success: false,
        error: `Falha ao criar empresa: ${tenantError?.message ?? 'erro desconhecido'}`,
      };
    }

    console.log('✅ Tenant criado com ID:', tenant.id);

    // Criar profissional
    console.log('Criando profissional com dados:', {
      tenant_id: tenant.id,
      user_id: userId,
      nome: data.fullName,
      especialidade: data.specialty,
      email,
      telefone: data.phone,
      role: 'admin',
    });

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

    console.log('[completeOnboarding] resultado profissional:', { profissionalError });

    if (profissionalError) {
      console.error('❌ Erro ao criar profissional:');
      console.error('  Código:', profissionalError.code);
      console.error('  Mensagem:', profissionalError.message);
      console.error('  Detalhes:', profissionalError.details);
      console.error('  Hint:', profissionalError.hint);
      console.error('  Erro completo (JSON):', JSON.stringify(profissionalError, null, 2));
      // Deletar tenant criado se falhar ao criar profissional
      console.log('Deletando tenant por falha no profissional...');
      await supabase.from('tenants').delete().eq('id', tenant.id);
      if (profissionalError.code === '23505') {
        return { success: false, error: 'Este usuário já possui um cadastro. Faça login.' };
      }
      return {
        success: false,
        error: `Falha ao criar perfil profissional: ${profissionalError.message ?? 'erro desconhecido'}`,
      };
    }

    console.log('✅ Profissional criado com sucesso');

    // Seed de feriados nacionais (nao bloqueia o onboarding em caso de falha).
    try {
      const anoAtual = new Date().getFullYear();
      const r1 = await seedFeriadosNacionais(anoAtual);
      const r2 = await seedFeriadosNacionais(anoAtual + 1);
      console.log(
        `✅ Feriados nacionais: ${r1.inseridos + r2.inseridos} inseridos (${anoAtual} e ${anoAtual + 1})`,
      );
    } catch (seedErr) {
      console.error(
        '⚠️ Falha ao popular feriados nacionais:',
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
        const r = await seedTemplatesAnamnese(
          profCriado.id as string,
          tenant.id as string,
          data.specialty,
        );
        console.log(
          `✅ Templates anamnese: ${r.inseridos} inseridos, ${r.existentes} existentes (de ${r.total} modelos)`,
        );
      } catch (seedErr) {
        console.error(
          '⚠️ Falha ao popular template de anamnese:',
          seedErr instanceof Error ? seedErr.message : seedErr,
        );
      }
    }

    console.log('=== completeOnboarding finalizado com sucesso ===');
    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Erro geral em completeOnboarding (catch):');
    console.error('  Tipo:', error instanceof Error ? error.name : typeof error);
    console.error('  Mensagem:', error instanceof Error ? error.message : String(error));
    console.error('  Stack:', error instanceof Error ? error.stack : '');
    console.error('  Erro completo (JSON):', JSON.stringify(error, Object.getOwnPropertyNames(error instanceof Error ? error : {}), 2));
    console.error('  Erro raw:', error);
    return { success: false, error: 'Erro ao processar solicitação. Tente novamente.' };
  }
}

// Usado pela pagina de /onboarding para evitar que um usuario que JA concluiu o
// cadastro veja o onboarding novamente. Usa a MESMA checagem (anon + RLS) do
// proxy/gate, garantindo decisao consistente e SEM loop de redirect entre
// /onboarding e as rotas protegidas.
export async function usuarioTemPerfilProfissional(): Promise<boolean> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return false;
  return hasProfessionalProfile(user.id);
}
