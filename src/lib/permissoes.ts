export type Role = 'admin' | 'profissional' | 'secretaria';

export type Acao =
  | 'configuracoes:editar'
  | 'equipe:gerenciar'
  | 'plano:alterar'
  | 'financeiro:ver'
  | 'financeiro:editar'
  | 'relatorios:ver'
  | 'relatorios:financeiro'
  | 'agenda:ver-todos'
  | 'agenda:editar'
  | 'pacientes:ver'
  | 'pacientes:editar'
  | 'atendimento:executar'
  | 'anamnese:ver'
  | 'anamnese:editar';

const PERMISSOES: Record<Role, Set<Acao>> = {
  admin: new Set([
    'configuracoes:editar',
    'equipe:gerenciar',
    'plano:alterar',
    'financeiro:ver',
    'financeiro:editar',
    'relatorios:ver',
    'relatorios:financeiro',
    'agenda:ver-todos',
    'agenda:editar',
    'pacientes:ver',
    'pacientes:editar',
    'atendimento:executar',
    'anamnese:ver',
    'anamnese:editar',
  ]),
  profissional: new Set<Acao>([
    'agenda:editar',
    'pacientes:ver',
    'pacientes:editar',
    'atendimento:executar',
    'anamnese:ver',
    'anamnese:editar',
    'relatorios:ver',
  ]),
  secretaria: new Set<Acao>([
    'agenda:ver-todos',
    'agenda:editar',
    'pacientes:ver',
    'pacientes:editar',
  ]),
};

export function isRole(value: string | null | undefined): value is Role {
  return value === 'admin' || value === 'profissional' || value === 'secretaria';
}

export function temPermissao(
  role: string | null | undefined,
  acao: Acao,
): boolean {
  if (!isRole(role)) return false;
  return PERMISSOES[role].has(acao);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  profissional: 'Profissional',
  secretaria: 'Secretária',
};

export const ROLE_BADGE_CLASS: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-700',
  profissional: 'bg-teal-100 text-teal-700',
  secretaria: 'bg-blue-100 text-blue-700',
};
