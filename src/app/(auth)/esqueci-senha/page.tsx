'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
});

type FormData = z.infer<typeof schema>;

export default function EsqueciSenhaPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [enviado, setEnviado] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setApiError('');

    try {
      const baseUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL ?? '';
      // PKCE: o Supabase devolve ?code=... no redirect; precisa passar pelo
      // /auth/callback para trocar o code por sessao antes de cair
      // em /redefinir-senha (a pagina exige sessao ativa).
      const redirectTo = `${baseUrl}/auth/callback?next=/redefinir-senha`;

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo,
      });

      if (error) {
        setApiError(error.message);
        return;
      }

      setEnviado(data.email);
    } catch (error) {
      setApiError('Erro ao enviar e-mail. Tente novamente.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (enviado) {
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
            E-mail enviado
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Enviamos um link para{' '}
            <span className="font-medium text-slate-900">{enviado}</span>.
            Verifique sua caixa de entrada.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm text-teal-700 hover:text-teal-700"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-teal-800">
          Esqueci minha senha
        </h1>
        <p className="text-base text-slate-500">
          Informe o e-mail da sua conta. Enviaremos um link para você criar uma
          nova senha.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-teal-700 hover:text-teal-700"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
