"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  Wallet,
  BarChart3,
  ClipboardList,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuloId, ModulosAtivos } from "@/lib/planos";

interface SidebarProps {
  logoUrl?: string | null;
  contagemListaEspera?: number;
  modulos?: ModulosAtivos;
}

type SidebarItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
  badgeKey?: "listaEspera";
  modulo?: ModuloId;
};

const items: SidebarItem[] = [
  { href: "/", label: "Dashboard", Icon: Home, exact: true },
  { href: "/agenda", label: "Agenda", Icon: Calendar },
  { href: "/pacientes", label: "Pacientes", Icon: Users },
  {
    href: "/lista-espera",
    label: "Lista de espera",
    Icon: ClipboardList,
    badgeKey: "listaEspera",
  },
  { href: "/financeiro", label: "Financeiro", Icon: Wallet },
  { href: "/estoque", label: "Estoque", Icon: Package, modulo: "estoque" },
  { href: "/relatorios", label: "Relatórios", Icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", Icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({
  logoUrl,
  contagemListaEspera = 0,
  modulos,
}: SidebarProps = {}) {
  const pathname = usePathname();
  const itensVisiveis = items.filter(
    (it) => !it.modulo || (modulos ? modulos[it.modulo] !== false : true),
  );

  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen bg-white border-r border-slate-200">
      <div className="px-6 py-5 border-b border-slate-200">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-primary-dark leading-tight"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className="max-h-8 w-auto object-contain"
            />
          ) : null}
          <span className="truncate">Sua Agenda Online</span>
        </Link>
      </div>
      <nav aria-label="Navegação lateral" className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {itensVisiveis.map(({ href, label, Icon, exact, badgeKey }) => {
            const active = isActive(pathname, href, exact);
            const badge =
              badgeKey === "listaEspera" && contagemListaEspera > 0
                ? contagemListaEspera
                : null;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-surface text-primary"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
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
      </nav>
    </aside>
  );
}

export default Sidebar;
