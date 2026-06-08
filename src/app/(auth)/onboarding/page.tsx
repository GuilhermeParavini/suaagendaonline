'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding, usuarioTemPerfilProfissional } from '@/actions/auth';
import { createClient } from '@/lib/supabase/client';
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
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const TIPOS_ATENDIMENTO = [
  { value: 'consultorio', label: 'Em consultório ou clínica própria' },
  { value: 'domicilio', label: 'Na residência dos pacientes/clientes' },
  { value: 'residencia', label: 'No meu endereço residencial' },
  { value: 'sem_local', label: 'Ainda não tenho local fixo' },
];

const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-600 focus:outline-none focus:ring-3 focus:ring-teal-100 transition';

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Passo 1 — dados do profissional
  const [nome, setNome] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [outroEspecialidade, setOutroEspecialidade] = useState('');
  const [registro, setRegistro] = useState('');
  const [telefone, setTelefone] = useState('');

  // Passo 2 — atendimento / clinica
  const [tipoAtendimento, setTipoAtendimento] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [telefoneConsultorio, setTelefoneConsultorio] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  const isOutro = especialidade === OUTRO_VALUE;
  const registroObrigatorio = especialidadeTemConselho(especialidade);

  // Redireciona convites para o fluxo de convite.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('convite');
    if (token) {
      router.replace(`/convite/${token}`);
    }
  }, [router]);

  // Se o usuario JA possui perfil profissional, nao deve ver o onboarding de
  // novo: redireciona para a home. Mesma checagem (anon + RLS) do proxy.
  useEffect(() => {
    let cancelado = false;
    usuarioTemPerfilProfissional().then((tem) => {
      if (!cancelado && tem) {
        router.replace('/inicio');
      }
    });
    return () => {
      cancelado = true;
    };
  }, [router]);

  // Pre-preenche nome e especialidade a partir do user_metadata salvo no signup.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const nomeMeta = (meta.nome_completo ?? meta.full_name) as
        | string
        | undefined;
      const espMeta = (meta.especialidade ?? meta.specialty) as
        | string
        | undefined;

      if (nomeMeta) setNome((prev) => prev || nomeMeta);
      if (espMeta) {
        // Se a especialidade do metadata estiver na lista, seleciona direto;
        // caso contrario, trata como "Outro" com o texto livre.
        const naLista = ESPECIALIDADES.some((e) => e.value === espMeta);
        if (naLista) {
          setEspecialidade((prev) => prev || espMeta);
        } else {
          setEspecialidade((prev) => prev || OUTRO_VALUE);
          setOutroEspecialidade((prev) => prev || espMeta);
        }
      }
    });
  }, []);

  const handleEspecialidadeChange = (nova: string) => {
    setEspecialidade(nova);
    // Limpa o registro ao trocar de especialidade e o texto livre ao sair de "Outro".
    setRegistro('');
    if (nova !== OUTRO_VALUE) setOutroEspecialidade('');
    setErrors((e) => ({
      ...e,
      especialidade: '',
      outroEspecialidade: '',
      registro: '',
    }));
  };

  // Passo 1: validacao manual. So avança se valido.
  const handleNext = () => {
    const novos: Record<string, string> = {};

    if (nome.trim().length < 3) {
      novos.nome = 'Nome deve ter no mínimo 3 caracteres';
    }
    if (!especialidade) {
      novos.especialidade = 'Selecione uma especialidade';
    }
    if (isOutro && outroEspecialidade.trim().length < 2) {
      novos.outroEspecialidade = 'Informe sua especialidade ou profissão';
    }
    if (registroObrigatorio) {
      const sug = getRegistroSugestao(especialidade);
      const valor = registro.trim();
      const sufixo = valor.startsWith(sug.prefixo)
        ? valor.slice(sug.prefixo.length).trim()
        : valor;
      if (sufixo.length < 2) {
        novos.registro = 'Registro profissional obrigatório';
      }
    }
    const tel = cleanPhone(telefone);
    if (!tel) {
      novos.telefone = 'Telefone é obrigatório';
    } else if (tel.length !== 10 && tel.length !== 11) {
      novos.telefone = 'Telefone inválido';
    }

    if (Object.keys(novos).length > 0) {
      setErrors(novos);
      return;
    }

    setErrors({});
    setStep(2);
  };

  // Passo 2: validacao manual e submit. onClick — nunca onSubmit.
  const handleComecar = async () => {
    console.log('[onboarding] botao comecar clicado');

    const novos: Record<string, string> = {};
    if (!tipoAtendimento) {
      novos.tipoAtendimento = 'Selecione onde você atende';
    }
    if (tipoAtendimento === 'consultorio' && nomeEmpresa.trim().length < 3) {
      novos.nomeEmpresa = 'Nome da empresa deve ter no mínimo 3 caracteres';
    }
    if (cidade.trim().length < 2) {
      novos.cidade = 'Cidade deve ter no mínimo 2 caracteres';
    }
    if (!estado) {
      novos.estado = 'Selecione um estado';
    }
    if (tipoAtendimento === 'consultorio' && telefoneConsultorio) {
      const t = cleanPhone(telefoneConsultorio);
      if (t.length !== 10 && t.length !== 11) {
        novos.telefoneConsultorio = 'Telefone inválido';
      }
    }

    if (Object.keys(novos).length > 0) {
      setErrors(novos);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const especialidadeFinal = isOutro
        ? outroEspecialidade.trim()
        : especialidade.trim();
      // Sem consultorio nao ha nome de empresa: usar o nome do profissional como
      // nome da "empresa"/tenant (profissional autonomo).
      const companyName =
        tipoAtendimento === 'consultorio' ? nomeEmpresa.trim() : nome.trim();

      const dados = {
        fullName: nome.trim(),
        specialty: especialidadeFinal,
        professionalRegistry: registro,
        phone: cleanPhone(telefone),
        companyName,
        companyPhone:
          tipoAtendimento === 'consultorio' && telefoneConsultorio
            ? cleanPhone(telefoneConsultorio)
            : undefined,
        city: cidade.trim(),
        state: estado,
        tipoAtendimento,
      };

      console.log('[onboarding] dados enviados:', dados);
      const result = await completeOnboarding(dados);
      console.log('[onboarding] resultado:', result);

      if (!result.success) {
        const msg = result.error ?? 'Não foi possível concluir o cadastro.';
        alert(msg);
        setLoading(false);
        return;
      }

      // Sucesso: navegacao "hard" para o proxy reavaliar o gate com o perfil novo.
      window.location.href = '/inicio';
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[onboarding] erro:', error);
      alert('Erro: ' + msg);
      setLoading(false);
    }
  };

  const stepperItems: FormStepperItem[] = [
    {
      id: 'seus-dados',
      label: 'Seus dados',
      status: step === 1 ? 'atual' : 'concluido',
    },
    {
      id: 'seu-atendimento',
      label: 'Seu atendimento',
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

      {/* Container (sem tag <form>) */}
      <div className="space-y-4">
        {step === 1 ? (
          <>
            {/* Nome completo */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                placeholder="Maria Silva"
                className={inputClass}
              />
              {errors.nome && (
                <p className="text-xs text-red-500">{errors.nome}</p>
              )}
            </div>

            {/* Especialidade */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Especialidade
              </label>
              <select
                value={especialidade}
                onChange={(e) => handleEspecialidadeChange(e.target.value)}
                autoComplete="off"
                className={`${inputClass} bg-white`}
              >
                <option value="">Selecione uma especialidade</option>
                {ESPECIALIDADES.map((esp) => (
                  <option key={esp.value} value={esp.value}>
                    {esp.label}
                  </option>
                ))}
              </select>
              {errors.especialidade && (
                <p className="text-xs text-red-500">{errors.especialidade}</p>
              )}
            </div>

            {/* Outro - Qual? */}
            {isOutro && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Qual sua especialidade/profissão?
                </label>
                <input
                  type="text"
                  value={outroEspecialidade}
                  onChange={(e) => setOutroEspecialidade(e.target.value)}
                  autoComplete="off"
                  placeholder="Ex: Acupuntura, Quiropraxia, Coaching..."
                  className={inputClass}
                />
                {errors.outroEspecialidade && (
                  <p className="text-xs text-red-500">
                    {errors.outroEspecialidade}
                  </p>
                )}
              </div>
            )}

            {/* Registro profissional */}
            <div>
              <RegistroInput
                especialidade={especialidade}
                value={registro}
                onChange={(v) => setRegistro(v)}
                required={registroObrigatorio}
              />
              {errors.registro && (
                <p className="mt-1 text-xs text-red-500">{errors.registro}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Telefone
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                autoComplete="tel"
                maxLength={15}
                placeholder="(11) 99999-9999"
                className={inputClass}
              />
              {errors.telefone && (
                <p className="text-xs text-red-500">{errors.telefone}</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Onde voce atende? (radio) — primeiro campo do passo 2 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Onde você atende?
              </label>
              <div className="space-y-2">
                {TIPOS_ATENDIMENTO.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg text-sm cursor-pointer transition ${
                      tipoAtendimento === opt.value
                        ? 'border-teal-600 bg-teal-50 ring-3 ring-teal-100'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipoAtendimento"
                      value={opt.value}
                      checked={tipoAtendimento === opt.value}
                      onChange={() => {
                        setTipoAtendimento(opt.value);
                        setErrors((e) => ({ ...e, tipoAtendimento: '' }));
                      }}
                      className="h-4 w-4 accent-teal-600"
                    />
                    <span className="text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
              {errors.tipoAtendimento && (
                <p className="text-xs text-red-500">{errors.tipoAtendimento}</p>
              )}
            </div>

            {/* Nome da empresa + telefone do consultorio — apenas para consultorio */}
            {tipoAtendimento === 'consultorio' && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Nome da empresa/consultório
                  </label>
                  <input
                    type="text"
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    autoComplete="organization"
                    placeholder="Clínica Silva"
                    className={inputClass}
                  />
                  {errors.nomeEmpresa && (
                    <p className="text-xs text-red-500">{errors.nomeEmpresa}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Telefone do consultório (opcional)
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={telefoneConsultorio}
                    onChange={(e) =>
                      setTelefoneConsultorio(formatPhone(e.target.value))
                    }
                    autoComplete="tel"
                    maxLength={15}
                    placeholder="(11) 3333-3333"
                    className={inputClass}
                  />
                  {errors.telefoneConsultorio && (
                    <p className="text-xs text-red-500">
                      {errors.telefoneConsultorio}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Cidade */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Cidade
              </label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                autoComplete="address-level2"
                placeholder="São Paulo"
                className={inputClass}
              />
              {errors.cidade && (
                <p className="text-xs text-red-500">{errors.cidade}</p>
              )}
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                autoComplete="address-level1"
                className={`${inputClass} bg-white`}
              >
                <option value="">Selecione um estado</option>
                {brazilianStates.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              {errors.estado && (
                <p className="text-xs text-red-500">{errors.estado}</p>
              )}
            </div>
          </>
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
              onClick={handleNext}
              className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComecar}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-teal-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {loading ? 'Salvando...' : 'Começar a usar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
