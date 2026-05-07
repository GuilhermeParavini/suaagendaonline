"use client";

import { Clock, MapPin, Phone, Star } from "lucide-react";
import { gerarLinkMaps } from "@/lib/whatsapp-templates";
import SeloLGPD from "@/components/ui/SeloLGPD";
import { cleanPhone, formatPhone } from "@/lib/masks";
import { cn } from "@/lib/utils";
import type {
  AvaliacaoResumo,
  HorarioFaixa,
} from "@/lib/agendamento-publico";

interface HeaderProfissionalPublicoProps {
  nome: string;
  especialidade: string;
  registroProfissional: string | null;
  avatarUrl: string | null;
  logoUrl: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  horarios: HorarioFaixa[];
  avaliacao: AvaliacaoResumo | null;
}

const DIAS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatarDias(dias: number[]): string {
  if (dias.length === 0) return "";
  const ordenados = [...dias].sort((a, b) => a - b);
  // Detecta sequencias contiguas (ex: 1,2,3,4,5 -> "Seg-Sex").
  const grupos: Array<[number, number]> = [];
  let inicio = ordenados[0];
  let prev = ordenados[0];
  for (let i = 1; i < ordenados.length; i++) {
    const atual = ordenados[i];
    if (atual === prev + 1) {
      prev = atual;
      continue;
    }
    grupos.push([inicio, prev]);
    inicio = atual;
    prev = atual;
  }
  grupos.push([inicio, prev]);
  return grupos
    .map(([a, b]) =>
      a === b ? DIAS_LABEL[a] : `${DIAS_LABEL[a]}-${DIAS_LABEL[b]}`,
    )
    .join(", ");
}

function formatarHorarios(horarios: HorarioFaixa[]): string {
  if (horarios.length === 0) return "";
  return horarios
    .map((h) => `${formatarDias(h.dias)} ${h.hora_inicio}-${h.hora_fim}`)
    .join(" | ");
}

function HeaderProfissionalPublico({
  nome,
  especialidade,
  registroProfissional,
  avatarUrl,
  logoUrl,
  telefone,
  endereco,
  cidade,
  estado,
  horarios,
  avaliacao,
}: HeaderProfissionalPublicoProps) {
  const enderecoCompleto =
    [endereco, [cidade, estado].filter(Boolean).join(" - ") || null]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join(", ") || null;
  const linkMaps = gerarLinkMaps(endereco, cidade, estado);
  const telDigits = cleanPhone(telefone ?? "");
  const horarioResumo = formatarHorarios(horarios);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="mx-auto mb-3 max-h-[48px] w-auto object-contain"
        />
      ) : null}

      <div className="flex flex-col items-center text-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`Foto de ${nome}`}
            className="h-20 w-20 rounded-full object-cover border border-slate-100"
          />
        ) : (
          <div
            role="img"
            aria-label={nome}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-[#CCFBF1] text-xl font-semibold text-[#115E59] select-none"
          >
            {getInitials(nome)}
          </div>
        )}

        <div className="space-y-1">
          <h1 className="text-[20px] font-semibold text-slate-900 leading-tight">
            {nome}
          </h1>
          <p className="text-base text-slate-500">{especialidade}</p>
          {registroProfissional ? (
            <p className="text-[14px] text-slate-500">{registroProfissional}</p>
          ) : null}
        </div>

        {avaliacao ? (
          <div
            className="inline-flex items-center gap-1.5"
            aria-label={`Nota ${avaliacao.media} de 5 com ${avaliacao.total} avaliacoes`}
          >
            <span className="inline-flex items-center" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => {
                const preenchido = i + 1 <= Math.round(avaliacao.media);
                return (
                  <Star
                    key={i}
                    width={16}
                    height={16}
                    strokeWidth={1.5}
                    className={cn(
                      preenchido
                        ? "text-[#F59E0B] fill-[#F59E0B]"
                        : "text-slate-300",
                    )}
                  />
                );
              })}
            </span>
            <span className="text-[14px] font-medium text-slate-900">
              {avaliacao.media.toFixed(1).replace(".", ",")}
            </span>
            <span className="text-[13px] text-slate-500">
              ({avaliacao.total}{" "}
              {avaliacao.total === 1 ? "avaliacao" : "avaliacoes"})
            </span>
          </div>
        ) : null}
      </div>

      {(enderecoCompleto || horarioResumo || telDigits) ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {enderecoCompleto ? (
            <div className="flex items-start gap-2 text-[14px] text-slate-700">
              <MapPin
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-slate-500"
              />
              <p className="leading-snug">
                {enderecoCompleto}
                {linkMaps ? (
                  <>
                    {" "}
                    <a
                      href={linkMaps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary-text hover:underline"
                    >
                      Como chegar
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {horarioResumo ? (
            <div className="flex items-start gap-2 text-[14px] text-slate-700">
              <Clock
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-slate-500"
              />
              <p className="leading-snug">{horarioResumo}</p>
            </div>
          ) : null}

          {telDigits ? (
            <div className="flex items-start gap-2 text-[14px] text-slate-700">
              <Phone
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-slate-500"
              />
              <a
                href={`tel:+55${telDigits}`}
                className="font-medium text-primary-text hover:underline"
              >
                {formatPhone(telDigits)}
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex justify-center">
        <SeloLGPD />
      </div>
    </section>
  );
}

export default HeaderProfissionalPublico;
