"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Users, Wallet, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/agenda", label: "Agenda", Icon: Calendar },
  { href: "/pacientes", label: "Pacientes", Icon: Users },
  { href: "/financeiro", label: "Financeiro", Icon: Wallet },
  { href: "/configuracoes", label: "Mais", Icon: Menu },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegacao principal"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex h-14">
        {items.map(({ href, label, Icon }) => {
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
                <Icon
                  size={24}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNav;
