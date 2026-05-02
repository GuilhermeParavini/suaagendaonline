'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Profissional {
  id: string;
  tenant_id: string;
  user_id: string;
  nome: string;
  especialidade: string;
  registro_profissional?: string;
  email: string;
  telefone?: string;
  bio?: string;
  avatar_url?: string;
  role: string;
  ativo: boolean;
}

interface Tenant {
  id: string;
  nome_empresa: string;
  slug: string;
  plano: string;
  status_assinatura: string;
  max_profissionais: number;
  trial_expira_em?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
}

interface UseTenantReturn {
  profissional: Profissional | null;
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
}

export function useTenant(): UseTenantReturn {
  const [profissional, setProfissional] = useState<Profissional | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obter usuário autenticado
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          setError('Usuário não autenticado');
          return;
        }

        // Buscar profissional
        const { data: prof, error: profError } = await supabase
          .from('profissionais')
          .select('*')
          .eq('user_id', userData.user.id)
          .single();

        if (profError) {
          // Usuário não tem perfil criado ainda
          setError('Perfil não encontrado');
          return;
        }

        setProfissional(prof as Profissional);

        // Buscar tenant
        const { data: ten, error: tenError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', prof.tenant_id)
          .single();

        if (tenError) {
          setError('Empresa não encontrada');
          return;
        }

        setTenant(ten as Tenant);
      } catch (err) {
        console.error('Erro ao buscar dados do tenant:', err);
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchTenantData();
  }, [supabase]);

  return { profissional, tenant, loading, error };
}
