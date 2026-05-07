"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { ProfissionalListItem } from "@/lib/agendamento-publico";

interface EscolherProfissionalProps {
  slug: string;
  tenantNome: string;
  profissionais: ProfissionalListItem[];
}

function EscolherProfissional({
  slug,
  tenantNome,
  profissionais,
}: EscolherProfissionalProps) {
  return (
    <div className="space-y-5">
      <header className="space-y-1 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Agendamento
        </p>
        <h1 className="text-xl font-semibold text-slate-900 leading-tight">
          {tenantNome}
        </h1>
        <p className="text-sm text-slate-500">Escolha o profissional</p>
      </header>

      <ul className="space-y-2">
        {profissionais.map((p) => (
          <li key={p.id}>
            <Link
              href={`/agendar/${slug}?profissional=${p.id}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 transition-colors hover:border-primary"
            >
              {p.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logo_url}
                  alt={p.nome}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <Avatar
                  name={p.nome}
                  className="h-12 w-12 text-base shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {p.nome}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {p.especialidade}
                </p>
                {p.bio ? (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {p.bio}
                  </p>
                ) : null}
              </div>
              <ChevronRight
                size={18}
                strokeWidth={1.5}
                aria-hidden="true"
                className="shrink-0 text-slate-500"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default EscolherProfissional;
