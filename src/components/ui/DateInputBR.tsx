"use client";

import { useId, useState } from "react";
import {
  brDateToIso,
  formatDate,
  isValidDate,
  isoToBrDate,
} from "@/lib/masks";
import { cn } from "@/lib/utils";

interface DateInputBRProps {
  /** Valor em ISO yyyy-MM-dd (ou string vazia) */
  value: string;
  /** Callback recebe ISO yyyy-MM-dd ou "" se invalida/incompleta */
  onChange: (iso: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function DateInputBR({
  value,
  onChange,
  label,
  required,
  disabled,
  placeholder = "DD/MM/AAAA",
  className,
}: DateInputBRProps) {
  const id = useId();
  const [buffer, setBuffer] = useState<string>(value ? isoToBrDate(value) : "");

  // Sincroniza quando o valor externo muda (ex.: reset).
  const externoBR = value ? isoToBrDate(value) : "";
  if (
    !disabled &&
    externoBR &&
    externoBR !== buffer &&
    isValidDate(buffer) === false
  ) {
    // Sem efeito: deixa o usuario terminar de digitar.
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatado = formatDate(e.target.value);
    setBuffer(formatado);
    if (formatado.length === 10 && isValidDate(formatado)) {
      onChange(brDateToIso(formatado) ?? "");
    } else {
      onChange("");
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <label
          htmlFor={id}
          className="block text-[13px] font-medium text-slate-700"
        >
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </label>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        value={buffer}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:bg-slate-50"
      />
    </div>
  );
}

export default DateInputBR;
