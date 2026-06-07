'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/actions/auth';
import { cleanPhone, formatPhone } from '@/lib/masks';
import { getRegistroSugestao } from '@/lib/registro-profissional';
import {
  ESPECIALIDADES,
  OUTRO_VALUE,
  especialidadeTemConselho,
} from '@/lib/especialidades';
import RegistroInput from '@/components/ui/RegistroInput';
import FormStepper, {
  type FormStepperItem,
} from '@/components/ui/FormStepper';

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
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

// Schema do passo 1 (dados do profissional). E validado isoladamente ao clicar
// "Próximo", para que o usuario nao consiga avançar com campos invalidos.
const step1Schema = z
  .object({
    fullName: trimmedString(3, 'Nome deve ter no mínimo 3 caracteres'),
    specialty: trimmedString(1, 'Selecione uma especialidade'),
    outroEspecialidade: z.string().optional(),
    professionalRegistry: z.string(),
    phone: phoneSchema,
  })
  .superRefine((data, ctx) => {
    // Quando "Outro" e selecionado, exigir o texto livre
    if (data.specialty === OUTRO_VALUE) {
      const livre = (data.outroEspecialidade ?? '').trim();
      if (livre.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['outroEspecialidade'],
          message: 'Informe sua especialidade ou profissão',
        });
      }
    }

    // Registro profissional so e obrigatorio quando a especialidade tem conselho
    if (especialidadeTemConselho(data.specialty)) {
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
    }
  });

// Schema do passo 2 (dados da clinica). E validado isoladamente ao submeter,
// sem revalidar os campos do passo 1 (que ja foram validados ao avançar).
const step2Schema = z.object({
  companyName: trimmedString(3, 'Nome da empresa deve ter no mínimo 3 caracteres'),
  companyPhone: optionalPhoneSchema,
  city: trimmedString(2, 'Cidade deve ter no mínimo 2 caracteres'),
  state: trimmedString(2, 'Selecione um estado'),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type OnboardingFormData = Step1Data & Step2Data;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const router = useRouter();

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
    getValues,
    setError,
    clearErrors,
  } = useForm<OnboardingFormData>({
    defaultValues: {
      fullName: '',
      specialty: '',
      outroEspecialidade: '',
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
  const isOutro = selectedSpecialty === OUTRO_VALUE;
  const registroObrigatorio = especialidadeTemConselho(selectedSpecialty);

  const handleSpecialtyChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nova = e.target.value;
    setValue('specialty', nova, {
      shouldValidate: true,
      shouldDirty: true,
    });
    // Limpa o registro ao trocar de especialidade
    setValue('professionalRegistry', '', {
      shouldValidate: false,
      shouldDirty: true,
    });
    // Limpa o campo livre quando sai de "Outro"
    if (nova !== OUTRO_VALUE) {
      setValue('outroEspecialidade', '', {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
  };

  const handlePhoneChange = (
    field: 'phone' | 'companyPhone',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const formatted = formatPhone(e.target.value);
    setValue(field, formatted, { shouldValidate: false, shouldDirty: true });
  };

  // Aplica as mensagens de um ZodError nos campos correspondentes, para que
  // apareçam destacadas abaixo de cada input.
  const applyZodErrors = (error: z.ZodError) => {
    for (const issue of error.issues) {
      const field = issue.path[0] as keyof OnboardingFormData | undefined;
      if (field) {
        setError(field, { type: 'manual', message: issue.message });
      }
    }
  };

  // Passo 1: valida APENAS os campos do passo 1. So avança se estiverem validos;
  // caso contrario, exibe os erros ali mesmo e nao deixa ir pro passo 2.
  const handleNextStep = () => {
    setApiError('');
    clearErrors();

    const result = step1Schema.safeParse(getValues());
    if (!result.success) {
      applyZodErrors(result.error);
      return;
    }

    setStep(2);
  };

  // Passo 2: valida APENAS os campos do passo 2 (os do passo 1 ja foram
  // validados ao avançar). Junta os dados dos dois passos e envia.
  const onSubmit = async () => {
    setApiError('');
    clearErrors();

    const raw = getValues();
    const parsed = step2Schema.safeParse(raw);
    if (!parsed.success) {
      applyZodErrors(parsed.error);
      return;
    }

    const step2Data = parsed.data;
    console.log('[onboarding] submit passo 2', { ...raw, ...step2Data });
    setIsLoading(true);

    try {
      const especialidadeFinal =
        raw.specialty === OUTRO_VALUE
          ? (raw.outroEspecialidade ?? '').trim()
          : raw.specialty.trim();

      // A autenticacao e resolvida dentro da server action (le a sessao dos
      // cookies). Nao dependemos mais do browser getUser, que estava retornando
      // vazio no passo 2 e derrubava o cadastro.
      const dados = {
        fullName: raw.fullName.trim(),
        specialty: especialidadeFinal,
        professionalRegistry: raw.professionalRegistry,
        phone: cleanPhone(raw.phone),
        companyName: step2Data.companyName,
        companyPhone: step2Data.companyPhone ? cleanPhone(step2Data.companyPhone) : undefined,
        city: step2Data.city,
        state: step2Data.state,
      };

      console.log('[onboarding] dados enviados:', dados);
      const result = await completeOnboarding(dados);
      console.log('[onboarding] resultado:', result);

      if (result.error) {
        // NUNCA voltar pro passo 1: ficar no passo 2 e mostrar o erro
        // (na tela E em alert, para que nunca passe despercebido).
        setApiError(result.error);
        alert(result.error);
        return;
      }

      // Sucesso (result.error === null): navegacao "hard" para o proxy reavaliar
      // o gate de onboarding com o perfil profissional recem-criado.
      window.location.href = '/inicio';
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[onboarding] erro:', error);
      // NUNCA voltar pro passo 1: ficar no passo 2 e mostrar o erro.
      setApiError('Erro: ' + msg);
      alert('Erro: ' + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const stepperItems: FormStepperItem[] = [
    {
      id: 'seus-dados',
      label: 'Seus dados',
      status: step === 1 ? 'atual' : 'concluido',
    },
    {
      id: 'sua-clinica',
      label: 'Sua clinica',
      status: step === 2 ? 'atual' : 'futuro',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold text-teal-800">
          Complete seu cadastro
        </h1>
      </div>

      <FormStepper steps={stepperItems} />

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
                  autoComplete="off"
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
                required={registroObrigatorio}
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
          <p
            key={apiError}
            className="sao-shake text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
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
              className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {isLoading ? 'Salvando...' : 'Começar a usar'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
