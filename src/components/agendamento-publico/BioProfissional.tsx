"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface BioProfissionalProps {
  bio: string | null;
}

function BioProfissional({ bio }: BioProfissionalProps) {
  const [expandido, setExpandido] = useState(false);
  const [trunca, setTrunca] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!bio) return;
    const el = ref.current;
    if (!el) return;
    // Detecta se o texto excede 2 linhas comparando alturas.
    const expandeMaior = el.scrollHeight > el.clientHeight + 1;
    setTrunca(expandeMaior);
  }, [bio]);

  if (!bio || !bio.trim()) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <p
        ref={ref}
        className="text-[14px] text-slate-600 leading-relaxed"
        style={
          expandido
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {bio}
      </p>
      {trunca ? (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary-text hover:underline"
        >
          {expandido ? (
            <>
              Ver menos
              <ChevronUp size={14} strokeWidth={1.5} aria-hidden="true" />
            </>
          ) : (
            <>
              Ver mais
              <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
            </>
          )}
        </button>
      ) : null}
    </section>
  );
}

export default BioProfissional;
