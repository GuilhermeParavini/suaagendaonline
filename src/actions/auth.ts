'use server';

import { createClient } from '@supabase/supabase-js';
import { seedFeriadosNacionais } from '@/actions/feriados';

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
  userId: string;
  email: string;
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
    console.log('Dados recebidos:', {
      userId: data.userId,
      email: data.email,
      fullName: data.fullName,
      specialty: data.specialty,
      phone: data.phone,
      companyName: data.companyName,
      city: data.city,
      state: data.state,
    });

    // Validar env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('SUPABASE_URL definida?', !!supabaseUrl);
    console.log('SERVICE_ROLE_KEY definida?', !!serviceRoleKey);
    console.log('SERVICE_ROLE_KEY prefixo:', serviceRoleKey?.substring(0, 12));
    console.log('SERVICE_ROLE_KEY tamanho:', serviceRoleKey?.length);
    console.log('SERVICE_ROLE_KEY é JWT?', serviceRoleKey?.startsWith('eyJ'));

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Variáveis de ambiente Supabase ausentes');
      return { error: 'Configuração do servidor inválida.' };
    }

    // Usar service role key para bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verificar se usuário já tem profissional/tenant
    const { data: existingProf } = await supabase
      .from('profissionais')
      .select('id, tenant_id')
      .eq('user_id', data.userId)
      .maybeSingle();

    if (existingProf) {
      console.log('⚠️ Usuário já possui cadastro completo. Tenant:', existingProf.tenant_id);
      return { error: null };
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
        max_profissionais: 1,
        trial_expira_em: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        telefone: data.companyPhone,
        cidade: data.city,
        estado: data.state,
      })
      .select()
      .single();

    if (tenantError || !tenant) {
      console.error('❌ Erro ao criar tenant:');
      console.error('  Código:', tenantError?.code);
      console.error('  Mensagem:', tenantError?.message);
      console.error('  Detalhes:', tenantError?.details);
      console.error('  Hint:', tenantError?.hint);
      console.error('  Erro completo (JSON):', JSON.stringify(tenantError, null, 2));
      console.error('  Tenant retornado:', tenant);
      return { error: 'Erro ao criar empresa. Tente novamente.' };
    }

    console.log('✅ Tenant criado com ID:', tenant.id);

    // Criar profissional
    console.log('Criando profissional com dados:', {
      tenant_id: tenant.id,
      user_id: data.userId,
      nome: data.fullName,
      especialidade: data.specialty,
      email: data.email,
      telefone: data.phone,
      role: 'admin',
    });

    const { error: profissionalError } = await supabase
      .from('profissionais')
      .insert({
        tenant_id: tenant.id,
        user_id: data.userId,
        nome: data.fullName,
        especialidade: data.specialty,
        registro_profissional: data.professionalRegistry || null,
        email: data.email,
        telefone: data.phone,
        role: 'admin',
        ativo: true,
      });

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
        return { error: 'Este usuário já possui um cadastro. Faça login.' };
      }
      return { error: 'Erro ao criar perfil. Tente novamente.' };
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

    console.log('=== completeOnboarding finalizado com sucesso ===');
    return { error: null };
  } catch (error) {
    console.error('❌ Erro geral em completeOnboarding (catch):');
    console.error('  Tipo:', error instanceof Error ? error.name : typeof error);
    console.error('  Mensagem:', error instanceof Error ? error.message : String(error));
    console.error('  Stack:', error instanceof Error ? error.stack : '');
    console.error('  Erro completo (JSON):', JSON.stringify(error, Object.getOwnPropertyNames(error instanceof Error ? error : {}), 2));
    console.error('  Erro raw:', error);
    return { error: 'Erro ao processar solicitação. Tente novamente.' };
  }
}
