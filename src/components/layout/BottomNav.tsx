"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  contagemListaEspera?: number;
}

const itensFixos: {
  href: string;
  label: string;
  Icon: LucideIcon;
}[] = [
  { href: "/agenda", label: "Agenda", Icon: Calendar },
  { href: "/pacientes", label: "Pacientes", Icon: Users },
  { href: "/financeiro", label: "Financeiro", Icon: Wallet },
];

type ItemMais = {
  href: string;
  label: string;
  Icon: LucideIcon;
  badgeKey?: "listaEspera";
};

const itensMais: ItemMais[] = [
  {
    href: "/lista-espera",
    label: "Lista de espera",
    Icon: ClipboardList,
    badgeKey: "listaEspera",
  },
  { href: "/relatorios", label: "Relatórios", Icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", Icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BottomNav({ contagemListaEspera = 0 }: BottomNavProps = {}) {
  const pathname = usePathname();
  const [maisOpen, setMaisOpen] = useState(false);
  const maisAtivo = itensMais.some((it) => isActive(pathname, it.href));
  const temBadgeMais = contagemListaEspera > 0;

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex h-14">
        {itensFixos.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-slate-400",
                )}
              >
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <Dialog.Root open={maisOpen} onOpenChange={setMaisOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Mais"
                className={cn(
                  "relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  maisAtivo ? "text-primary" : "text-slate-400",
                )}
              >
                <Menu size={24} strokeWidth={1.5} aria-hidden="true" />
                <span>Mais</span>
                {temBadgeMais ? (
                  <span className="absolute right-3 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {contagemListaEspera}
                  </span>
                ) : null}
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <Dialog.Content
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white shadow-lg",
                  "px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)] focus:outline-none",
                )}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Dialog.Title className="text-base font-semibold text-slate-900">
                    Mais
                  </Dialog.Title>
                  <Dialog.Close
                    aria-label="Fechar"
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </Dialog.Close>
                </div>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {itensMais.map(({ href, label, Icon, badgeKey }) => {
                    const active = isActive(pathname, href);
                    const badge =
                      badgeKey === "listaEspera" && contagemListaEspera > 0
                        ? contagemListaEspera
                        : null;
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => setMaisOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                            active
                              ? "text-primary bg-primary-surface"
                              : "text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          <Icon
                            size={20}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          <span className="flex-1">{label}</span>
                          {badge ? (
                            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                              {badge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </li>
      </ul>
    </nav>
  );
}

export default BottomNav;
