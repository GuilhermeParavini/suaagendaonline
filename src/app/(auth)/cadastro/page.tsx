'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ESPECIALIDADES, OUTRO_VALUE } from '@/lib/especialidades';

const signupSchema = z
  .object({
    fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string(),
    specialty: z.string().min(1, 'Selecione uma especialidade'),
    outroEspecialidade: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })
  .superRefine((data, ctx) => {
    if (data.specialty === OUTRO_VALUE) {
      const valor = (data.outroEspecialidade ?? '').trim();
      if (valor.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['outroEspecialidade'],
          message: 'Informe sua especialidade ou profissão',
        });
      }
    }
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
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
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      specialty: '',
      outroEspecialidade: '',
    },
  });

  const selectedSpecialty = watch('specialty');
  const isOutro = selectedSpecialty === OUTRO_VALUE;

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setApiError('');

    try {
      const especialidadeFinal =
        data.specialty === OUTRO_VALUE
          ? (data.outroEspecialidade ?? '').trim()
          : data.specialty;

      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          // Salvar nome e especialidade no user_metadata para pre-preencher o
          // onboarding apos a confirmacao de email. Mantemos as chaves em ingles
          // (full_name/specialty) por compatibilidade e adicionamos as chaves em
          // PT-BR (nome_completo/especialidade) usadas no pre-preenchimento.
          data: {
            full_name: data.fullName,
            specialty: especialidadeFinal,
            nome_completo: data.fullName,
            especialidade: especialidadeFinal,
          },
        },
      });

      if (error) {
        setApiError(error.message);
        return;
      }

      setShowSuccess(true);
      setTimeout(() => {
        router.push(conviteToken ? `/login?convite=${conviteToken}` : '/login');
      }, 3000);
    } catch (error) {
      setApiError('Erro ao criar conta. Tente novamente.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Verifique seu e-mail
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Enviamos um link de confirmação para seu e-mail. Clique no link
              para ativar sua conta.
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Redirecionando para login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold text-teal-800">
          Crie sua conta
        </h1>
        <p className="text-sm text-slate-500">
          14 dias grátis, sem cartão de crédito
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Nome completo
          </label>
          <input
            {...register('fullName')}
            type="text"
            placeholder="Maria Silva"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
          />
          {errors.fullName && (
            <p className="text-xs text-red-500">{errors.fullName.message}</p>
          )}
        </div>

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
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
          />
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Confirmar senha
          </label>
          <input
            {...register('confirmPassword')}
            type="password"
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Specialty */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Especialidade
          </label>
          <select
            {...register('specialty')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition bg-white"
          >
            <option value="">Selecione uma especialidade</option>
            {ESPECIALIDADES.map((esp) => (
              <option key={esp.value} value={esp.value}>
                {esp.label}
              </option>
            ))}
          </select>
          {errors.specialty && (
            <p className="text-xs text-red-500">{errors.specialty.message}</p>
          )}
        </div>

        {/* Outro - Qual? */}
        {isOutro && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Qual sua especialidade/profissão?
            </label>
            <input
              {...register('outroEspecialidade')}
              type="text"
              placeholder="Ex: Acupuntura, Quiropraxia, Coaching..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
            />
            {errors.outroEspecialidade && (
              <p className="text-xs text-red-500">
                {errors.outroEspecialidade.message}
              </p>
            )}
          </div>
        )}

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
          {isLoading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      {/* Sign In Link */}
      <div className="text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link href="/login" className="text-teal-700 hover:text-teal-700 font-medium">
          Entrar
        </Link>
      </div>
    </div>
  );
}
