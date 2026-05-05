"use client";

import type { FollowUpCard } from "@/lib/assistente-parser";

interface FollowUpCardsProps {
  followUps: FollowUpCard[];
  onClick: (pergunta: string) => void;
  disabled?: boolean;
}

function FollowUpCards({ followUps, onClick, disabled }: FollowUpCardsProps) {
  if (followUps.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {followUps.map((f, i) => (
        <button
          key={`${i}-${f.texto}`}
          type="button"
          onClick={() => onClick(f.pergunta)}
          disabled={disabled}
          className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm text-teal-700 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {f.texto}
        </button>
      ))}
    </div>
  );
}

export default FollowUpCards;
