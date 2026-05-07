"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, RotateCcw, X } from "lucide-react";
import {
  carregarTemplates,
  restaurarPadrao,
  salvarTemplate,
  TEMPLATES_PADRAO,
  VARIAVEIS_DISPONIVEIS,
  type TemplateMensagem,
} from "@/lib/templates-mensagem";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

const ORDEM: TemplateMensagem["tipo"][] = [
  "confirmacao",
  "lembrete",
  "pre_consulta",
  "documento",
  "retorno",
];

function SecaoTemplatesMensagem() {
  const [templates, setTemplates] = useState<TemplateMensagem[]>(
    TEMPLATES_PADRAO,
  );
  const [editando, setEditando] = useState<TemplateMensagem | null>(null);
  const [conteudoAtual, setConteudoAtual] = useState("");

  useEffect(() => {
    // localStorage so existe no client; sincroniza apos hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTemplates(carregarTemplates());
  }, []);

  const abrirEdicao = (tpl: TemplateMensagem) => {
    setEditando(tpl);
    setConteudoAtual(tpl.conteudo);
  };

  const fechar = () => {
    setEditando(null);
    setConteudoAtual("");
  };

  const handleSalvar = () => {
    if (!editando) return;
    const atualizado: TemplateMensagem = {
      ...editando,
      conteudo: conteudoAtual,
    };
    const novos = salvarTemplate(atualizado);
    setTemplates(novos);
    fechar();
  };

  const handleRestaurar = () => {
    if (!editando) return;
    const novos = restaurarPadrao(editando.id);
    setTemplates(novos);
    const padrao = novos.find((t) => t.id === editando.id);
    if (padrao) {
      setConteudoAtual(padrao.conteudo);
      setEditando(padrao);
    }
  };

  const ordenados = [...templates].sort((a, b) => {
    const ia = ORDEM.indexOf(a.tipo);
    const ib = ORDEM.indexOf(b.tipo);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">
          Templates de mensagem
        </h2>
        <p className="text-[13px] text-slate-500">
          Personalize os textos enviados via WhatsApp. Use as variaveis entre
          chaves para inserir dados do paciente e da consulta.
        </p>
      </header>

      <ul className="space-y-2">
        {ordenados.map((tpl) => {
          const padrao = TEMPLATES_PADRAO.find((p) => p.id === tpl.id);
          const modificado = padrao && padrao.conteudo !== tpl.conteudo;
          return (
            <li
              key={tpl.id}
              className="rounded-lg border border-slate-200 bg-white p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-slate-900">
                    {tpl.nome}
                    {modificado ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Personalizado
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => abrirEdicao(tpl)}
                  aria-label={`Editar ${tpl.nome}`}
                  className="inline-flex items-center gap-1 rounded border border-primary px-3 py-1.5 text-[13px] font-medium text-primary-text hover:bg-primary-surface transition-colors"
                >
                  <Pencil size={13} strokeWidth={1.5} aria-hidden="true" />
                  Editar
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded border border-slate-100 bg-slate-50 p-2 text-[12px] text-slate-700 font-sans">
                {tpl.conteudo}
              </pre>
            </li>
          );
        })}
      </ul>

      <Dialog.Root
        open={editando !== null}
        onOpenChange={(v) => (v ? null : fechar())}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className={cn(
              "fixed z-50 bg-white shadow-lg focus:outline-none flex flex-col",
              "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),16px)]",
              "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[640px] md:max-w-[calc(100vw-32px)] md:max-h-[90vh] md:rounded-2xl md:p-6",
            )}
          >
            <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 shrink-0" />
            <div className="flex items-start justify-between gap-3 shrink-0">
              <Dialog.Title className="text-base font-semibold text-slate-900">
                Editar template
              </Dialog.Title>
              <Dialog.Close
                aria-label="Fechar"
                className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} strokeWidth={1.5} />
              </Dialog.Close>
            </div>

            {editando ? (
              <div className="mt-4 flex-1 overflow-y-auto space-y-4">
                <div>
                  <label
                    htmlFor="conteudo-template"
                    className="block text-[14px] font-medium text-slate-900"
                  >
                    {editando.nome}
                  </label>
                  <textarea
                    id="conteudo-template"
                    value={conteudoAtual}
                    onChange={(e) => setConteudoAtual(e.target.value)}
                    rows={10}
                    className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-[#94A3B8] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  />
                </div>

                <div className="rounded border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p className="text-[13px] font-medium text-slate-900">
                    Variaveis disponiveis
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {VARIAVEIS_DISPONIVEIS.map((v) => (
                      <li
                        key={v.chave}
                        className="text-[13px] text-slate-700"
                      >
                        <code className="rounded bg-white px-1.5 py-0.5 text-[12px] text-primary-text">
                          {`{${v.chave}}`}
                        </code>{" "}
                        — {v.descricao}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] text-slate-500">
                    Linhas com variaveis vazias sao removidas automaticamente
                    no envio.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="sticky bottom-0 -mx-4 md:mx-0 mt-3 flex flex-col-reverse sm:flex-row sm:justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3 md:px-0 shrink-0">
              <Button
                variant="ghost"
                onClick={handleRestaurar}
                className="inline-flex items-center gap-1.5"
              >
                <RotateCcw
                  size={14}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                Restaurar padrao
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button variant="ghost" onClick={fechar}>
                  Cancelar
                </Button>
                <Button onClick={handleSalvar}>Salvar</Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

export default SecaoTemplatesMensagem;
