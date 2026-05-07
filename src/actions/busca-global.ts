"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cleanPhone, formatPhone } from "@/lib/masks";

export type ResultadoBuscaTipo = "paciente" | "pagina" | "agendamento";

export type ResultadoBusca = {
  tipo: ResultadoBuscaTipo;
  /** Identificador estavel (id do paciente, slug da pagina, id do agendamento). */
  id: string;
  titulo: string;
  subtitulo: string | null;
  url: string;
  /** Nome do icone Lucide para o cliente renderizar. */
  icone: string;
};

/**
 * Paginas estaticas do sistema. A filtragem e local (sem ir ao banco), entao
 * a lista vive aqui mas pode ser duplicada no client se preferir totalmente
 * offline. Mantida na action para garantir uma unica fonte de verdade.
 */
const PAGINAS: Array<{
  id: string;
  titulo: string;
  url: string;
  icone: string;
  termos: string[];
}> = [
  {
    id: "inicio",
    titulo: "Inicio",
    url: "/",
    icone: "Home",
    termos: ["inicio", "home", "agenda do dia", "hoje"],
  },
  {
    id: "dashboard",
    titulo: "Dashboard",
    url: "/dashboard",
    icone: "BarChart3",
    termos: ["dashboard", "metricas", "indicadores"],
  },
  {
    id: "agenda",
    titulo: "Agenda",
    url: "/agenda",
    icone: "Calendar",
    termos: ["agenda", "calendario", "agendamentos"],
  },
  {
    id: "pacientes",
    titulo: "Pacientes",
    url: "/pacientes",
    icone: "Users",
    termos: ["pacientes", "clientes"],
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    url: "/financeiro",
    icone: "Wallet",
    termos: ["financeiro", "dinheiro", "receitas", "despesas", "pagamentos"],
  },
  {
    id: "relatorios",
    titulo: "Relatorios",
    url: "/relatorios",
    icone: "LineChart",
    termos: ["relatorios", "graficos"],
  },
  {
    id: "configuracoes",
    titulo: "Configuracoes",
    url: "/configuracoes",
    icone: "Settings",
    termos: ["configuracoes", "ajustes", "perfil", "senha"],
  },
  {
    id: "estoque",
    titulo: "Estoque",
    url: "/estoque",
    icone: "Package",
    termos: ["estoque", "produtos", "materiais"],
  },
  {
    id: "lista-espera",
    titulo: "Lista de espera",
    url: "/lista-espera",
    icone: "ClipboardList",
    termos: ["lista de espera", "fila", "espera"],
  },
];

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function buscarPaginas(termo: string): ResultadoBusca[] {
  const t = normalizar(termo);
  if (t.length === 0) return [];
  return PAGINAS.filter((p) =>
    p.termos.some((termo2) => normalizar(termo2).includes(t)),
  ).map((p) => ({
    tipo: "pagina" as const,
    id: p.id,
    titulo: p.titulo,
    subtitulo: null,
    url: p.url,
    icone: p.icone,
  }));
}

export async function buscaGlobal(termo: string): Promise<ResultadoBusca[]> {
  const t = (termo ?? "").trim();
  if (t.length < 2) {
    // Sem termo significativo: ainda devolve atalhos de paginas que tem o
    // prefixo digitado (ou todos quando vazio, para o palette inicial).
    if (t.length === 0) return [];
    return buscarPaginas(t);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return buscarPaginas(t);

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profissionais")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!prof) return buscarPaginas(t);

  const tenantId = prof.tenant_id as string;
  const profissionalId = prof.id as string;
  const digits = cleanPhone(t);

  const consultas: Promise<ResultadoBusca[]>[] = [];

  // 1) Pacientes — limite 5
  consultas.push(
    (async () => {
      const safeNome = t.replace(/[,()*]/g, " ").trim();
      let q = admin
        .from("pacientes")
        .select("id, nome, telefone, email")
        .eq("tenant_id", tenantId)
        .eq("ativo", true);
      if (digits.length >= 3) {
        q = q.or(`nome.ilike.*${safeNome}*,telefone.ilike.*${digits}*`);
      } else {
        q = q.ilike("nome", `%${safeNome}%`);
      }
      const { data } = await q.order("nome").limit(5);
      return (data ?? []).map((p) => ({
        tipo: "paciente" as const,
        id: p.id as string,
        titulo: p.nome as string,
        subtitulo: p.telefone
          ? formatPhone(p.telefone as string)
          : ((p.email as string | null) ?? null),
        url: `/pacientes/${p.id as string}`,
        icone: "User",
      }));
    })(),
  );

  // 2) Agendamentos de hoje — limite 3
  consultas.push(
    (async () => {
      const agora = new Date();
      const hoje = `${agora.getUTCFullYear()}-${String(
        agora.getUTCMonth() + 1,
      ).padStart(2, "0")}-${String(agora.getUTCDate()).padStart(2, "0")}`;
      const inicio = `${hoje}T00:00:00.000Z`;
      const fim = `${hoje}T23:59:59.999Z`;
      const { data } = await admin
        .from("agendamentos")
        .select(
          "id, data_hora, pacientes(id, nome), procedimentos(nome)",
        )
        .eq("tenant_id", tenantId)
        .eq("profissional_id", profissionalId)
        .gte("data_hora", inicio)
        .lte("data_hora", fim)
        .order("data_hora", { ascending: true });
      const linhas = (data ?? []) as Array<{
        id: string;
        data_hora: string;
        pacientes: { id: string; nome: string } | { id: string; nome: string }[] | null;
        procedimentos: { nome: string } | { nome: string }[] | null;
      }>;
      const norm = normalizar(t);
      return linhas
        .filter((r) => {
          const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
          if (!pac) return false;
          return normalizar(pac.nome).includes(norm);
        })
        .slice(0, 3)
        .map((r) => {
          const pac = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
          const proc = Array.isArray(r.procedimentos)
            ? r.procedimentos[0]
            : r.procedimentos;
          const hora = new Date(r.data_hora).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          });
          return {
            tipo: "agendamento" as const,
            id: r.id,
            titulo: pac?.nome ?? "Paciente",
            subtitulo: proc?.nome ? `${hora} - ${proc.nome}` : `${hora}`,
            url: `/agenda?ag=${r.id}`,
            icone: "Calendar",
          };
        });
    })(),
  );

  // 3) Paginas — sempre executa, e local
  const paginas = buscarPaginas(t);

  const [pacientes, agendamentos] = await Promise.all(consultas);

  // Ordem de exibicao: pacientes -> paginas -> agendamentos.
  return [...pacientes, ...paginas, ...agendamentos];
}
