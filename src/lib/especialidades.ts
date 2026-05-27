export type Especialidade = {
  value: string;
  label: string;
  temConselho: boolean;
};

export const OUTRO_VALUE = "Outro";

export const ESPECIALIDADES: Especialidade[] = [
  { value: "Barbearia", label: "Barbearia", temConselho: false },
  { value: "Cardiologia", label: "Cardiologia", temConselho: true },
  { value: "Enfermagem", label: "Enfermagem", temConselho: true },
  { value: "Estética", label: "Estética", temConselho: false },
  { value: "Fisioterapia", label: "Fisioterapia", temConselho: true },
  { value: "Fonoaudiologia", label: "Fonoaudiologia", temConselho: true },
  { value: "Medicina", label: "Medicina", temConselho: true },
  { value: "Nutrição", label: "Nutrição", temConselho: true },
  { value: "Odontologia", label: "Odontologia", temConselho: true },
  { value: "Podologia", label: "Podologia", temConselho: false },
  { value: "Psicologia", label: "Psicologia", temConselho: true },
  { value: "Terapia Ocupacional", label: "Terapia Ocupacional", temConselho: true },
  { value: OUTRO_VALUE, label: "Outro", temConselho: false },
];

export function especialidadeTemConselho(especialidade: string | null | undefined): boolean {
  if (!especialidade) return false;
  const found = ESPECIALIDADES.find((e) => e.value === especialidade);
  if (found) return found.temConselho;
  return false;
}

export function isEspecialidadeOutro(value: string | null | undefined): boolean {
  return value === OUTRO_VALUE;
}
