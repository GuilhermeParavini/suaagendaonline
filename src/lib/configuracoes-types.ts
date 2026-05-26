// Tipos compartilhados das configuracoes.
// Mantidos fora de src/actions/configuracoes.ts porque arquivos com
// 'use server' so podem exportar funcoes async — qualquer outro export
// (type, const, interface) pode causar erro de build em producao.

export type AssinaturaTipo = 'fonte' | 'imagem';
export type AssinaturaFonte = 'Dancing Script' | 'Great Vibes' | 'Pacifico';

export type ProfissionalConfig = {
  id: string;
  tenant_id: string;
  nome: string;
  especialidade: string;
  registro_profissional: string | null;
  email: string;
  telefone: string | null;
  bio: string | null;
  role: string;
  assinatura_tipo: AssinaturaTipo | null;
  assinatura_fonte: string | null;
  assinatura_url: string | null;
  logo_url: string | null;
  enviar_avaliacao: boolean;
  enviar_followup: boolean;
  mostrar_acompanhamento: boolean;
  followup_mensagem: string | null;
  intervalo_entre_consultas_min: number;
};

export type TenantConfig = {
  id: string;
  nome_empresa: string;
  slug: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  plano: string;
  trial_expira_em: string | null;
};

export type TenantContato = {
  nome_empresa: string;
  slug: string;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
};

export type HorarioBloco = {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
};

export type Procedimento = {
  id: string;
  nome: string;
  duracao_min: number;
  valor: number | null;
  ativo: boolean;
};

export type AtualizarProfissionalInput = {
  nome: string;
  especialidade: string;
  registro_profissional?: string;
  telefone: string;
  bio?: string;
  intervalo_entre_consultas_min?: number;
};

export type AtualizarTenantInput = {
  nome_empresa: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
};

export type ProcedimentoInput = {
  nome: string;
  duracao_min: number;
  valor?: number | null;
};
