'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const router = useRouter();
  const supabase = createClient();
  const [conviteToken, setConviteToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setConviteToken(params.get('convite'));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setApiError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setApiError(error.message);
        return;
      }

      router.push(conviteToken ? `/convite/${conviteToken}` : '/');
      router.refresh();
    } catch (error) {
      setApiError('Erro ao fazer login. Tente novamente.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-teal-800">
          Sua Agenda Online
        </h1>
        <p className="text-base text-slate-500">Acesse sua conta</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="seu@email.com"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Senha
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* API Error */}
        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      {/* Forgot Password Link */}
      <div className="text-center">
        <Link
          href="/esqueci-senha"
          className="text-sm text-teal-600 hover:text-teal-700"
        >
          Esqueci minha senha
        </Link>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-white text-slate-500">ou</span>
        </div>
      </div>

      {/* Sign Up Link */}
      <Link
        href="/cadastro"
        className="block w-full text-center bg-white border border-teal-600 text-teal-600 py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-50 transition"
      >
        Criar conta - 14 dias grátis
      </Link>
    </div>
  );
}
