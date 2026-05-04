import type { LucideIcon } from 'lucide-react';
import {
  CalendarOff,
  Hospital,
  MoreHorizontal,
  Plane,
  Presentation,
  Sparkles,
} from 'lucide-react';
import type { BloqueioTipo } from '@/actions/bloqueios';

export type BloqueioTipoMeta = {
  value: BloqueioTipo;
  label: string;
  Icon: LucideIcon;
};

export const BLOQUEIO_TIPOS: BloqueioTipoMeta[] = [
  { value: 'ferias', label: 'Férias', Icon: Plane },
  { value: 'folga', label: 'Folga', Icon: CalendarOff },
  { value: 'congresso', label: 'Congresso/Evento', Icon: Presentation },
  { value: 'licenca', label: 'Licença médica', Icon: Hospital },
  { value: 'outro', label: 'Outro', Icon: MoreHorizontal },
];

const META_FALLBACK: BloqueioTipoMeta = {
  value: 'outro',
  label: 'Outro',
  Icon: MoreHorizontal,
};

export function getBloqueioTipoMeta(
  tipo: BloqueioTipo | string | null | undefined,
): BloqueioTipoMeta {
  if (tipo === 'feriado') {
    return { value: 'feriado', label: 'Feriado', Icon: Sparkles };
  }
  return BLOQUEIO_TIPOS.find((t) => t.value === tipo) ?? META_FALLBACK;
}
