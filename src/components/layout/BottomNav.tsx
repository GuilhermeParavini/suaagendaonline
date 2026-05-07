"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Home,
  LineChart,
  Menu,
  Package,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuloId, ModulosAtivos } from "@/lib/planos";

interface BottomNavProps {
  contagemListaEspera?: number;
  modulos?: ModulosAtivos;
  /** Tenant criado ha N dias. Usado para esconder itens avancados nos primeiros 3 dias. */
  tenantCriadoHaDias?: number | null;
  /** Quando true, todos os itens avancados aparecem (checklist 100%). */
  onboardingCompleto?: boolean;
}

type ItemFixo = {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
  tour?: string;
};

const itensFixos: ItemFixo[] = [
  { href: "/", label: "Inicio", Icon: Home, exact: true },
  { href: "/agenda", label: "Agenda", Icon: Calendar },
  {
    href: "/pacientes",
    label: "Pacientes",
    Icon: Users,
    tour: "menu-pacientes-mobile",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    Icon: Wallet,
    tour: "menu-financeiro-mobile",
  },
];

type ItemMais = {
  href: string;
  label: string;
  Icon: LucideIcon;
  badgeKey?: "listaEspera";
  modulo?: ModuloId;
  /** Item avancado — escondido para tenants novos com onboarding incompleto. */
  avancado?: boolean;
  prefetch?: boolean;
};

const itensMais: ItemMais[] = [
  { href: "/dashboard", label: "Dashboard", Icon: BarChart3, prefetch: false },
  {
    href: "/lista-espera",
    label: "Lista de espera",
    Icon: ClipboardList,
    badgeKey: "listaEspera",
    avancado: true,
    prefetch: false,
  },
  {
    href: "/estoque",
    label: "Estoque",
    Icon: Package,
    modulo: "estoque",
    avancado: true,
    prefetch: false,
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    Icon: LineChart,
    avancado: true,
    prefetch: false,
  },
  { href: "/configuracoes", label: "Configurações", Icon: Settings, prefetch: false },
];

function isActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BottomNav({
  contagemListaEspera = 0,
  modulos,
  tenantCriadoHaDias = null,
  onboardingCompleto = false,
}: BottomNavProps = {}) {
  const pathname = usePathname();
  const [maisOpen, setMaisOpen] = useState(false);

  const tenantNovo =
    tenantCriadoHaDias !== null &&
    tenantCriadoHaDias < 3 &&
    !onboardingCompleto;
  const mostrarBadgeNovo =
    tenantCriadoHaDias !== null &&
    tenantCriadoHaDias >= 3 &&
    tenantCriadoHaDias <= 10 &&
    onboardingCompleto;

  const itensMaisVisiveis = itensMais.filter((it) => {
    if (it.modulo && modulos && modulos[it.modulo] === false) return false;
    if (tenantNovo && it.avancado) return false;
    return true;
  });
  const maisAtivo = itensMaisVisiveis.some((it) => isActive(pathname, it.href));
  const temBadgeMais = contagemListaEspera > 0;

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex h-14">
        {itensFixos.map(({ href, label, Icon, exact, tour }) => {
          const active = isActive(pathname, href, exact);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                data-tour={tour}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary-text" : "text-slate-500",
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
                data-tour="menu-mais-mobile"
                className={cn(
                  "relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  maisAtivo ? "text-primary-text" : "text-slate-500",
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
                  {itensMaisVisiveis.map(
                    ({ href, label, Icon, badgeKey, avancado, prefetch }) => {
                      const active = isActive(pathname, href);
                      const badge =
                        badgeKey === "listaEspera" && contagemListaEspera > 0
                          ? contagemListaEspera
                          : null;
                      const ehNovo = mostrarBadgeNovo && avancado;
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={() => setMaisOpen(false)}
                            prefetch={prefetch ?? true}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                              active
                                ? "text-primary-text bg-primary-surface"
                                : "text-slate-700 hover:bg-slate-50",
                            )}
                          >
                            <Icon
                              size={20}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                            <span className="flex-1">{label}</span>
                            {ehNovo && !badge ? (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                Novo
                              </span>
                            ) : null}
                            {badge ? (
                              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                                {badge}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    },
                  )}
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
