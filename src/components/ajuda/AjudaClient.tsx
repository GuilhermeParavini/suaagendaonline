"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Search } from "lucide-react";
import { SECOES_AJUDA, type ItemAjuda, type SecaoAjuda } from "./ajuda-content";
import { limparCacheERecarregar } from "@/lib/pwa";
import { cn } from "@/lib/utils";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default function AjudaClient() {
  const [busca, setBusca] = useState("");
  const [secaoAberta, setSecaoAberta] = useState<string | null>(
    SECOES_AJUDA[0]?.id ?? null,
  );
  const [itemAberto, setItemAberto] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const forcarAtualizacao = () => {
    setAtualizando(true);
    void limparCacheERecarregar();
  };

  const buscaNormalizada = normalizar(busca.trim());

  const secoesFiltradas = useMemo(() => {
    if (!buscaNormalizada) return SECOES_AJUDA;

    return SECOES_AJUDA.map((s) => {
      const tituloMatch = normalizar(s.titulo).includes(buscaNormalizada);
      const itensFiltrados = s.itens.filter((item) => {
        const alvo = normalizar(`${item.pergunta} ${item.resposta}`);
        return alvo.includes(buscaNormalizada);
      });
      if (tituloMatch || itensFiltrados.length > 0) {
        return { ...s, itens: tituloMatch ? s.itens : itensFiltrados };
      }
      return null;
    }).filter((s): s is SecaoAjuda => s !== null);
  }, [buscaNormalizada]);

  // Quando ha busca, abrir todas as secoes resultantes.
  const secoesParaRenderizar = secoesFiltradas.map((s) => ({
    secao: s,
    aberta: buscaNormalizada ? true : secaoAberta === s.id,
  }));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-[22px] font-semibold text-slate-900 leading-tight">
          Central de Ajuda
        </h1>
        <p className="text-sm text-slate-500">
          Tire dúvidas sobre o Agenda4U. Não encontrou o que precisa? Escreva
          para info@appagenda4u.com.
        </p>
      </header>

      {/* Busca */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar ajuda… (ex.: anamnese, recibo, plano)"
          className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D9488] focus:outline-none focus:ring-[3px] focus:ring-[#0D9488]/15"
        />
      </div>

      {/* Lista de seções */}
      {secoesParaRenderizar.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Nenhum resultado para <strong>“{busca}”</strong>. Tente outra
          palavra-chave.
        </div>
      ) : (
        <ul className="space-y-3">
          {secoesParaRenderizar.map(({ secao, aberta }) => {
            const { Icon } = secao;
            return (
              <li
                key={secao.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSecaoAberta((cur) =>
                      cur === secao.id ? null : secao.id,
                    )
                  }
                  aria-expanded={aberta}
                  aria-controls={`secao-${secao.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0FDFA] text-[#0D9488]">
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900">
                      {secao.titulo}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {secao.itens.length}{" "}
                      {secao.itens.length === 1 ? "tópico" : "tópicos"}
                    </span>
                  </span>
                  {aberta ? (
                    <ChevronUp
                      size={18}
                      className="shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                </button>

                {aberta ? (
                  <div
                    id={`secao-${secao.id}`}
                    className="divide-y divide-slate-100 border-t border-slate-100"
                  >
                    {secao.itens.map((item, idx) => {
                      const itemId = `${secao.id}-${idx}`;
                      const abertoItem =
                        itemAberto === itemId || Boolean(buscaNormalizada);
                      return (
                        <Item
                          key={itemId}
                          item={item}
                          aberto={abertoItem}
                          onToggle={() =>
                            setItemAberto((cur) =>
                              cur === itemId ? null : itemId,
                            )
                          }
                          destacarTexto={buscaNormalizada}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Forcar atualizacao — saida de emergencia para SW preso em versao antiga. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0FDFA] text-[#0D9488]">
            <RefreshCw size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">
              App travado ou desatualizado?
            </h2>
            <p className="text-[13px] leading-relaxed text-slate-600">
              Se a tela ficar em branco, travada ou mostrando uma versão
              antiga, force a atualização. Isso limpa o cache do aplicativo e
              recarrega a versão mais recente. Seus dados não são afetados.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={forcarAtualizacao}
          disabled={atualizando}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#115E59] disabled:opacity-70"
        >
          <RefreshCw
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className={atualizando ? "animate-spin" : ""}
          />
          {atualizando ? "Atualizando…" : "Forçar atualização do app"}
        </button>
      </section>

      <footer className="rounded-xl border border-dashed border-[#99F6E4] bg-[#F0FDFA]/40 p-4 text-sm text-slate-700">
        Ainda com dúvida?{" "}
        <a
          href="mailto:info@appagenda4u.com"
          className="font-semibold text-[#0D9488] hover:text-[#115E59] hover:underline"
        >
          info@appagenda4u.com
        </a>{" "}
        — respondemos em até 1 dia útil.
      </footer>
    </div>
  );
}

function Item({
  item,
  aberto,
  onToggle,
  destacarTexto,
}: {
  item: ItemAjuda;
  aberto: boolean;
  onToggle: () => void;
  destacarTexto: string;
}) {
  return (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 text-left"
      >
        <span
          className={cn(
            "min-w-0 flex-1 text-sm font-medium",
            aberto ? "text-[#115E59]" : "text-slate-800",
          )}
        >
          {destacarTexto
            ? destacar(item.pergunta, destacarTexto)
            : item.pergunta}
        </span>
        {aberto ? (
          <ChevronUp
            size={16}
            className="shrink-0 text-slate-400"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            size={16}
            className="shrink-0 text-slate-400"
            aria-hidden="true"
          />
        )}
      </button>

      {aberto ? (
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          {destacarTexto
            ? destacar(item.resposta, destacarTexto)
            : item.resposta}
        </p>
      ) : null}
    </div>
  );
}

// Destaca trechos que batem com a busca. Usa fatia case-insensitive
// preservando o texto original.
function destacar(texto: string, alvoNormalizado: string) {
  if (!alvoNormalizado) return texto;
  const baseNormalizada = normalizar(texto);
  const idx = baseNormalizada.indexOf(alvoNormalizado);
  if (idx === -1) return texto;
  const fim = idx + alvoNormalizado.length;
  return (
    <>
      {texto.slice(0, idx)}
      <mark className="rounded bg-[#FFE4C7] px-0.5 text-[#9A3412]">
        {texto.slice(idx, fim)}
      </mark>
      {texto.slice(fim)}
    </>
  );
}
