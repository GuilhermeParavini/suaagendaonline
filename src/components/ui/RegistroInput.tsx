"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { getRegistroSugestao } from "@/lib/registro-profissional";

interface RegistroInputProps {
  especialidade: string | null | undefined;
  value: string;
  onChange: (valorCompleto: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  showHelper?: boolean;
  required?: boolean;
}

function extrairSufixo(valor: string, prefixo: string): string {
  if (!prefixo) return valor;
  if (valor.startsWith(prefixo)) return valor.slice(prefixo.length);
  return valor;
}

function RegistroInput({
  especialidade,
  value,
  onChange,
  disabled,
  className,
  inputClassName,
  showHelper = true,
  required = true,
}: RegistroInputProps) {
  const sug = getRegistroSugestao(especialidade);
  const id = useId();

  const sufixo = extrairSufixo(value ?? "", sug.prefixo);

  const handleChange = (novoSufixo: string) => {
    const limpo = novoSufixo.trimStart();
    onChange(`${sug.prefixo}${limpo}`);
  };

  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-[14px] font-medium text-slate-900">
        {sug.label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      <div
        className={cn(
          "flex w-full items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white",
          "focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/10 transition",
          disabled && "bg-slate-50 text-slate-500",
        )}
      >
        {sug.prefixo ? (
          <span
            aria-hidden="true"
            className="inline-flex shrink-0 items-center bg-slate-100 px-3 text-sm font-medium text-slate-600 select-none border-r border-slate-200"
          >
            {sug.prefixo.trimEnd()}
          </span>
        ) : null}
        <input
          id={id}
          type="text"
          value={sufixo}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder={sug.placeholder}
          autoComplete="off"
          required={required}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed",
            inputClassName,
          )}
        />
      </div>
      {showHelper ? (
        <p className="text-xs text-slate-500">
          Conselho sugerido: {sug.orgao}.
          {sug.prefixo
            ? ` Prefixo "${sug.prefixo.trimEnd()}" fixo. Complete com o número.`
            : ' Altere se necessário.'}
        </p>
      ) : null}
    </div>
  );
}

export default RegistroInput;
