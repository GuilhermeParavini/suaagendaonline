"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  Wallet,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
};

const items: SidebarItem[] = [
  { href: "/", label: "Dashboard", Icon: Home, exact: true },
  { href: "/agenda", label: "Agenda", Icon: Calendar },
  { href: "/pacientes", label: "Pacientes", Icon: Users },
  { href: "/financeiro", label: "Financeiro", Icon: Wallet },
  { href: "/relatorios", label: "Relatórios", Icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", Icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:sticky lg:top-0 lg:h-screen bg-white border-r border-slate-200">
      <div className="px-6 py-5 border-b border-slate-200">
        <Link
          href="/"
          className="text-lg font-semibold text-primary-dark leading-tight"
        >
          Sua Agenda Online
        </Link>
      </div>
      <nav aria-label="Navegacao lateral" className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, Icon, exact }) => {
            const active = isActive(pathname, href, exact);
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
                  <span>{label}</span>
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
