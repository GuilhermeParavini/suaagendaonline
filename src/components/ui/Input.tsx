import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showOptional?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, required, showOptional, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[14px] font-medium text-slate-900 leading-tight"
        >
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
          ) : showOptional ? (
            <span className="ml-1 text-[13px] font-normal text-slate-500">
              (opcional)
            </span>
          ) : null}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={cn(
          "w-full rounded border bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-[#94A3B8] transition-shadow duration-150 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
          hasError
            ? "border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]"
            : "border-slate-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(13,148,136,0.1)]",
          className,
        )}
        {...props}
      />
      {hasError && (
        <span id={errorId} className="text-[13px] text-danger leading-tight">
          {error}
        </span>
      )}
    </div>
  );
});

export default Input;
