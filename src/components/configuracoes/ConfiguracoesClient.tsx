"use client";

import { useCallback, useState, useTransition } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  getConfiguracoes,
  type HorarioBloco,
  type Procedimento,
  type ProfissionalConfig,
  type TenantConfig,
} from "@/actions/configuracoes";
import { cn } from "@/lib/utils";
import TabMeusDados from "./TabMeusDados";
import TabHorarios from "./TabHorarios";
import TabProcedimentos from "./TabProcedimentos";
import TabBloqueios from "./TabBloqueios";

interface ConfiguracoesClientProps {
  initialProfissional: ProfissionalConfig;
  initialTenant: TenantConfig;
  initialHorarios: HorarioBloco[];
  initialProcedimentos: Procedimento[];
}

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

      <Tabs.Root defaultValue="dados" className="space-y-5">
        <Tabs.List
          aria-label="Configurações"
          className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1"
        >
          {[
            { value: "dados", label: "Meus dados" },
            { value: "horarios", label: "Horários" },
            { value: "procedimentos", label: "Procedimentos" },
            { value: "bloqueios", label: "Bloqueios" },
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

        <Tabs.Content value="bloqueios" className="focus:outline-none">
          <TabBloqueios />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export default ConfiguracoesClient;
