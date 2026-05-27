"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { getConfiguracoes } from "@/actions/configuracoes";
import type {
  HorarioBloco,
  Procedimento,
  ProfissionalConfig,
  TenantConfig,
} from "@/lib/configuracoes-types";
import { cn } from "@/lib/utils";
import TabMeusDados from "./TabMeusDados";
import TabHorarios from "./TabHorarios";
import TabProcedimentos from "./TabProcedimentos";
import TabBloqueios from "./TabBloqueios";
import TabAnamnese from "./TabAnamnese";
import TabEquipe from "./TabEquipe";

interface ConfiguracoesClientProps {
  initialProfissional: ProfissionalConfig;
  initialTenant: TenantConfig;
  initialHorarios: HorarioBloco[];
  initialProcedimentos: Procedimento[];
}

const TABS_VALIDAS = [
  "dados",
  "horarios",
  "procedimentos",
  "anamnese",
  "bloqueios",
  "equipe",
] as const;
type TabValida = (typeof TABS_VALIDAS)[number];

function ConfiguracoesClient({
  initialProfissional,
  initialTenant,
  initialHorarios,
  initialProcedimentos,
}: ConfiguracoesClientProps) {
  const [profissional, setProfissional] =
    useState<ProfissionalConfig>(initialProfissional);
  const [tenant, setTenant] = useState<TenantConfig>(initialTenant);
  const [horarios, setHorarios] = useState<HorarioBloco[]>(initialHorarios);
  const [procedimentos, setProcedimentos] =
    useState<Procedimento[]>(initialProcedimentos);
  const [, startTransition] = useTransition();

  // Aceita ?tab=<aba> vindo de links externos (ex.: checklist de primeiro
  // uso). Aba inexistente ou indisponivel para o role cai em "dados".
  const searchParams = useSearchParams();
  const abaInicial = useMemo<TabValida>(() => {
    const raw = searchParams?.get("tab");
    if (!raw) return "dados";
    if (!(TABS_VALIDAS as readonly string[]).includes(raw)) return "dados";
    if (raw === "equipe" && profissional.role !== "admin") return "dados";
    return raw as TabValida;
  }, [searchParams, profissional.role]);

  const recarregar = useCallback(() => {
    startTransition(async () => {
      const result = await getConfiguracoes();
      if (!result.ok) return;
      setProfissional(result.data.profissional);
      setTenant(result.data.tenant);
      setHorarios(result.data.horarios);
      setProcedimentos(result.data.procedimentos);
    });
  }, []);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Configurações
        </h1>
        <p className="text-sm text-slate-500">
          Gerencie seus dados, horários e procedimentos.
        </p>
      </header>

      <Tabs.Root defaultValue={abaInicial} className="space-y-5">
        <Tabs.List
          aria-label="Configurações"
          className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1"
        >
          {[
            { value: "dados", label: "Meus dados" },
            { value: "horarios", label: "Horários" },
            { value: "procedimentos", label: "Procedimentos" },
            { value: "anamnese", label: "Anamnese" },
            { value: "bloqueios", label: "Bloqueios" },
            ...(profissional.role === "admin"
              ? [{ value: "equipe", label: "Equipe" }]
              : []),
          ].map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className={cn(
                "flex-1 whitespace-nowrap rounded px-3 py-2 text-sm font-medium transition-colors",
                "data-[state=active]:bg-primary-surface data-[state=active]:text-primary-dark",
                "text-slate-500 hover:text-slate-900",
              )}
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="dados" className="focus:outline-none">
          <TabMeusDados
            profissional={profissional}
            tenant={tenant}
            onSaved={recarregar}
          />
        </Tabs.Content>

        <Tabs.Content value="horarios" className="focus:outline-none">
          <TabHorarios horarios={horarios} onSaved={recarregar} />
        </Tabs.Content>

        <Tabs.Content value="procedimentos" className="focus:outline-none">
          <TabProcedimentos
            procedimentos={procedimentos}
            onChanged={recarregar}
          />
        </Tabs.Content>

        <Tabs.Content value="anamnese" className="focus:outline-none">
          <TabAnamnese especialidade={profissional.especialidade} />
        </Tabs.Content>

        <Tabs.Content value="bloqueios" className="focus:outline-none">
          <TabBloqueios />
        </Tabs.Content>

        {profissional.role === "admin" ? (
          <Tabs.Content value="equipe" className="focus:outline-none">
            <TabEquipe />
          </Tabs.Content>
        ) : null}
      </Tabs.Root>
    </div>
  );
}

export default ConfiguracoesClient;
