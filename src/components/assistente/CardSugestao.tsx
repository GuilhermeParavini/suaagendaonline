"use client";

import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  ClipboardList,
  Clock,
  DollarSign,
  MessageCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CardSugestao as CardSugestaoData } from "@/actions/assistente-sugestoes";
import { cn } from "@/lib/utils";

const ICONE_MAP: Record<string, LucideIcon> = {
  Calendar,
  CalendarPlus,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  ClipboardList,
};

interface CardSugestaoProps {
  card: CardSugestaoData;
  onClick: (card: CardSugestaoData) => void;
}

function CardSugestao({ card, onClick }: CardSugestaoProps) {
  const Icone = ICONE_MAP[card.icone] ?? MessageCircle;
  const destaque = card.cor_destaque === "amber";

  return (
    <button
      type="button"
      onClick={() => onClick(card)}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors",
        destaque
          ? "border-l-4 border-amber-400 bg-amber-50/40 hover:bg-amber-50"
          : "bg-white hover:bg-teal-50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex shrink-0 items-center justify-center",
          destaque ? "text-amber-600" : "text-teal-600",
        )}
      >
        <Icone size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{card.titulo}</p>
        <p className="mt-0.5 text-sm text-gray-500 leading-snug">
          {card.preview}
        </p>
      </div>
    </button>
  );
}

export default CardSugestao;
