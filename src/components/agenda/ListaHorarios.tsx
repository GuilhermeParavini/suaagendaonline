import CardAgendamento from "./CardAgendamento";
import type { AgendamentoDia } from "@/actions/agendamentos";

interface ListaHorariosProps {
  agendamentos: AgendamentoDia[];
  horaInicio?: number;
  horaFim?: number;
  intervaloMin?: number;
  onSelecionar?: (agendamento: AgendamentoDia) => void;
  mostrarProfissional?: boolean;
}

type Slot = { key: string; label: string; agendamento: AgendamentoDia | null };

function buildSlots(
  agendamentos: AgendamentoDia[],
  horaInicio: number,
  horaFim: number,
  intervaloMin: number,
): Slot[] {
  const agendamentosPorSlot = new Map<string, AgendamentoDia>();
  for (const ag of agendamentos) {
    const dt = new Date(ag.data_hora);
    const h = dt.getUTCHours();
    const m = dt.getUTCMinutes();
    const slotMin = Math.floor(m / intervaloMin) * intervaloMin;
    const key = `${String(h).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`;
    agendamentosPorSlot.set(key, ag);
  }

  const slots: Slot[] = [];
  for (let h = horaInicio; h < horaFim; h++) {
    for (let m = 0; m < 60; m += intervaloMin) {
      const key = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      slots.push({
        key,
        label: key,
        agendamento: agendamentosPorSlot.get(key) ?? null,
      });
    }
  }
  return slots;
}

function ListaHorarios({
  agendamentos,
  horaInicio = 8,
  horaFim = 18,
  intervaloMin = 30,
  onSelecionar,
  mostrarProfissional,
}: ListaHorariosProps) {
  if (agendamentos.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">Nenhum agendamento neste dia.</p>
      </div>
    );
  }

  const slots = buildSlots(agendamentos, horaInicio, horaFim, intervaloMin);

  return (
    <ol className="flex flex-col">
      {slots.map((slot) => (
        <li key={slot.key} className="flex items-stretch gap-3 py-1.5">
          <span className="w-12 shrink-0 pt-2 text-right text-[11px] font-medium text-slate-400 leading-none">
            {slot.label}
          </span>
          <div className="flex-1 min-w-0">
            {slot.agendamento ? (
              <CardAgendamento
                agendamento={slot.agendamento}
                onClick={onSelecionar}
                mostrarProfissional={mostrarProfissional}
              />
            ) : (
              <div className="h-full min-h-[36px] border-t border-dashed border-slate-200" />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default ListaHorarios;
