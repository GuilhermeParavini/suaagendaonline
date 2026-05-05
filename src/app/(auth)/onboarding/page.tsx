'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { completeOnboarding } from '@/actions/auth';
import { cleanPhone, formatPhone } from '@/lib/masks';
import { getRegistroSugestao } from '@/lib/registro-profissional';
import RegistroInput from '@/components/ui/RegistroInput';

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const specialties = [
  'Podologia',
  'Fisioterapia',
  'Terapia Ocupacional',
  'Nutrição',
  'Psicologia',
  'Odontologia',
  'Fonoaudiologia',
  'Medicina',
  'Cardiologia',
  'Enfermagem',
  'Outra',
];

const trimmedString = (min: number, msg: string) =>
  z.string().transform((s) => s.trim()).refine((s) => s.length >= min, { message: msg });

const phoneSchema = z
  .string()
  .refine((s) => {
    const digits = cleanPhone(s);
    return digits.length === 10 || digits.length === 11;
  }, { message: 'Telefone inválido' });

const optionalPhoneSchema = z
  .string()
  .optional()
  .refine((s) => {
    if (!s) return true;
    const digits = cleanPhone(s);
    return digits.length === 0 || digits.length === 10 || digits.length === 11;
  }, { message: 'Telefone inválido' });

const fullSchema = z
  .object({
    fullName: trimmedString(3, 'Nome deve ter no mínimo 3 caracteres'),
    specialty: trimmedString(1, 'Selecione uma especialidade'),
    professionalRegistry: z.string(),
    phone: phoneSchema,
    companyName: trimmedString(3, 'Nome da empresa deve ter no mínimo 3 caracteres'),
    companyPhone: optionalPhoneSchema,
    city: trimmedString(2, 'Cidade deve ter no mínimo 2 caracteres'),
    state: trimmedString(2, 'Selecione um estado'),
  })
  .superRefine((data, ctx) => {
    const sug = getRegistroSugestao(data.specialty);
    const valor = (data.professionalRegistry ?? '').trim();
    const sufixo = valor.startsWith(sug.prefixo)
      ? valor.slice(sug.prefixo.length).trim()
      : valor;
    if (sufixo.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['professionalRegistry'],
        message: 'Registro profissional obrigatório',
      });
    }
  });

type OnboardingFormData = z.infer<typeof fullSchema>;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('convite');
    if (token) {
      router.replace(`/convite/${token}`);
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(fullSchema),
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      specialty: '',
      professionalRegistry: '',
      phone: '',
      companyName: '',
      companyPhone: '',
      city: '',
      state: '',
    },
  });

  const selectedSpecialty = watch('specialty');
  const professionalRegistry = watch('professionalRegistry');

  const handleSpecialtyChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setValue('specialty', e.target.value, {
      shouldValidate: true,
      shouldDirty: true,
    });
    // Limpa o registro ao trocar de especialidade
    setValue('professionalRegistry', '', {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  const handlePhoneChange = (
    field: 'phone' | 'companyPhone',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const formatted = formatPhone(e.target.value);
    setValue(field, formatted, { shouldValidate: false, shouldDirty: true });
  };

  const handleNextStep = async () => {
    setApiError('');

    // Validar apenas os campos do passo 1
    const fieldsToValidate = [
      'fullName',
      'specialty',
      'professionalRegistry',
      'phone',
    ] as const;
    const isValid = await trigger(fieldsToValidate);

    if (isValid) {
      setStep(2);
    }
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsLoading(true);
    setApiError('');

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setApiError('Usuário não autenticado');
        return;
      }

      const result = await completeOnboarding({
        userId: user.user.id,
        email: user.user.email!,
        fullName: data.fullName,
        specialty: data.specialty,
        professionalRegistry: data.professionalRegistry,
        phone: cleanPhone(data.phone),
        companyName: data.companyName,
        companyPhone: data.companyPhone ? cleanPhone(data.companyPhone) : undefined,
        city: data.city,
        state: data.state,
      });

      if (result.error) {
        setApiError(result.error);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (error) {
      setApiError('Erro ao completar cadastro. Tente novamente.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold text-teal-800">
          Complete seu cadastro
        </h1>
        <p className="text-sm text-slate-500">
          Passo {step} de 2
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
        {step === 1 ? (
          <>
            {/* Full Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Nome completo
              </label>
              <input
                {...register('fullName')}
                type="text"
                autoComplete="name"
                placeholder="Maria Silva"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
              />
              {errors.fullName && (
                <p className="text-xs text-red-500">{errors.fullName.message}</p>
              )}
            </div>

            {/* Specialty */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Especialidade
              </label>
              <select
                value={selectedSpecialty ?? ''}
                onChange={handleSpecialtyChange}
                autoComplete="off"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition bg-white"
              >
                <option value="">Selecione uma especialidade</option>
                {specialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
              {errors.specialty && (
                <p className="text-xs text-red-500">{errors.specialty.message}</p>
              )}
            </div>

            {/* Professional Registry */}
            <div>
              <RegistroInput
                especialidade={selectedSpecialty}
                value={professionalRegistry ?? ''}
                onChange={(v) =>
                  setValue('professionalRegistry', v, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
              {errors.professionalRegistry && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.professionalRegistry.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Telefone
              </label>
              <input
                {...register('phone', {
                  onChange: (e) => handlePhoneChange('phone', e),
                })}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
                placeholder="(11) 99999-9999"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Company Name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Nome da empresa/consultório
              </label>
              <input
                {...register('companyName')}
                type="text"
                autoComplete="organization"
                placeholder="Clínica Silva"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
              />
              {errors.companyName && (
                <p className="text-xs text-red-500">{errors.companyName.message}</p>
              )}
            </div>

            {/* Company Phone */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Telefone do consultório (opcional)
              </label>
              <input
                {...register('companyPhone', {
                  onChange: (e) => handlePhoneChange('companyPhone', e),
                })}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
                placeholder="(11) 3333-3333"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
              />
              {errors.companyPhone && (
                <p className="text-xs text-red-500">{errors.companyPhone.message}</p>
              )}
            </div>

            {/* City */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Cidade
              </label>
              <input
                {...register('city')}
                type="text"
                autoComplete="address-level2"
                placeholder="São Paulo"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition"
              />
              {errors.city && (
                <p className="text-xs text-red-500">{errors.city.message}</p>
              )}
            </div>

            {/* State */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                {...register('state')}
                autoComplete="address-level1"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition bg-white"
              >
                <option value="">Selecione um estado</option>
                {brazilianStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              {errors.state && (
                <p className="text-xs text-red-500">{errors.state.message}</p>
              )}
            </div>
          </>
        )}

        {/* API Error */}
        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {apiError}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
            >
              Voltar
            </button>
          )}
          {step === 1 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Próximo
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Processando...' : 'Começar a usar'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
