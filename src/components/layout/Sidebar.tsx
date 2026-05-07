"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  Wallet,
  BarChart3,
  LineChart,
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
  /** Tenant criado ha N dias. Usado para esconder itens avancados nos primeiros 3 dias. */
  tenantCriadoHaDias?: number | null;
  /** Quando true, todos os itens avancados aparecem (checklist 100%). */
  onboardingCompleto?: boolean;
}

type SidebarItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
  badgeKey?: "listaEspera";
  modulo?: ModuloId;
  /** Marca itens avancados — escondidos para tenants novos com onboarding incompleto. */
  avancado?: boolean;
  /** Atributo data-tour do elemento (anexa ao Link). */
  tour?: string;
  /**
   * Define se o Next.js deve fazer prefetch automatico do JS da rota.
   * Para rotas pouco usadas (relatorios/estoque/lista-espera), desativamos
   * para nao competir por bandwidth no carregamento inicial.
   */
  prefetch?: boolean;
};

const items: SidebarItem[] = [
  { href: "/", label: "Inicio", Icon: Home, exact: true, prefetch: true },
  { href: "/dashboard", label: "Dashboard", Icon: BarChart3, prefetch: false },
  { href: "/agenda", label: "Agenda", Icon: Calendar, prefetch: true },
  {
    href: "/pacientes",
    label: "Pacientes",
    Icon: Users,
    tour: "menu-pacientes",
    prefetch: true,
  },
  {
    href: "/lista-espera",
    label: "Lista de espera",
    Icon: ClipboardList,
    badgeKey: "listaEspera",
    avancado: true,
    prefetch: false,
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    Icon: Wallet,
    tour: "menu-financeiro",
    prefetch: true,
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
  {
    href: "/configuracoes",
    label: "Configurações",
    Icon: Settings,
    tour: "menu-configuracoes",
    prefetch: false,
  },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({
  logoUrl,
  contagemListaEspera = 0,
  modulos,
  tenantCriadoHaDias = null,
  onboardingCompleto = false,
}: SidebarProps = {}) {
  const pathname = usePathname();

  // Tenant novo: criado ha menos de 3 dias E onboarding incompleto.
  const tenantNovo =
    tenantCriadoHaDias !== null &&
    tenantCriadoHaDias < 3 &&
    !onboardingCompleto;

  // Badge "Novo": tenant entre 3 e 10 dias com onboarding completo
  // (acabou de revelar os itens avancados).
  const mostrarBadgeNovo =
    tenantCriadoHaDias !== null &&
    tenantCriadoHaDias >= 3 &&
    tenantCriadoHaDias <= 10 &&
    onboardingCompleto;

  const itensVisiveis = items.filter((it) => {
    if (it.modulo && modulos && modulos[it.modulo] === false) return false;
    if (tenantNovo && it.avancado) return false;
    return true;
  });

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
          {itensVisiveis.map(
            ({
              href,
              label,
              Icon,
              exact,
              badgeKey,
              avancado,
              tour,
              prefetch,
            }) => {
              const active = isActive(pathname, href, exact);
              const badgeContagem =
                badgeKey === "listaEspera" && contagemListaEspera > 0
                  ? contagemListaEspera
                  : null;
              const ehNovo = mostrarBadgeNovo && avancado;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    data-tour={tour}
                    prefetch={prefetch ?? true}
                    className={cn(
                      "flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-surface text-primary-text"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {ehNovo && !badgeContagem ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Novo
                      </span>
                    ) : null}
                    {badgeContagem ? (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                        {badgeContagem}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            },
          )}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
