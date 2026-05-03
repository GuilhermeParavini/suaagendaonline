'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const schema = z
  .object({
    senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    confirmar: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  })
  .refine((d) => d.senha === d.confirmar, {
    path: ['confirmar'],
    message: 'As senhas não coincidem',
  });

type FormData = z.infer<typeof schema>;

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [sessaoOk, setSessaoOk] = useState<boolean | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    let cancelado = false;
    (async () => {
      // Se a URL trouxer ?code=..., faz a troca por sessao manualmente.
      // Importante para o fluxo PKCE quando o link nao passou pelo /auth/callback.
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code).catch(() => {});
          // Limpa o code da URL para nao re-processar
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          window.history.replaceState({}, '', url.toString());
        }
      }
      const { data } = await supabase.auth.getUser();
      if (cancelado) return;
      setSessaoOk(!!data.user);
    })();
    return () => {
      cancelado = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!sucesso) return;
    const t = window.setTimeout(() => {
      supabase.auth.signOut().finally(() => {
        router.push('/login');
        router.refresh();
      });
    }, 2000);
    return () => window.clearTimeout(t);
  }, [sucesso, router, supabase]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setApiError('');
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.senha,
      });
      if (error) {
        setApiError(error.message);
        return;
      }
      setSucesso(true);
    } catch (e) {
      setApiError('Erro ao redefinir senha. Tente novamente.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#D1FAE5]">
          <Check
            size={32}
            strokeWidth={2.5}
            className="text-[#065F46]"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-teal-800">
            Senha redefinida
          </h1>
          <p className="text-sm text-slate-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  if (sessaoOk === false) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-teal-800">
            Link inválido ou expirado
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Solicite um novo link para redefinir sua senha.
          </p>
        </div>
        <Link
          href="/esqueci-senha"
          className="inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-teal-800">
          Redefinir senha
        </h1>
        <p className="text-base text-slate-500">Crie uma nova senha de acesso.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Nova senha
          </label>
          <div className="relative">
            <input
              {...register('senha')}
              type={showSenha ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSenha((v) => !v)}
              aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.senha && (
            <p className="text-xs text-red-500">{errors.senha.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              {...register('confirmar')}
              type={showConfirmar ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmar((v) => !v)}
              aria-label={
                showConfirmar ? 'Ocultar senha' : 'Mostrar senha'
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmar && (
            <p className="text-xs text-red-500">{errors.confirmar.message}</p>
          )}
        </div>

        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || sessaoOk === null}
          className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Redefinindo...' : 'Redefinir senha'}
        </button>
      </form>
    </div>
  );
}
