import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
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
          className="text-[13px] font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={cn(
          "w-full rounded border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-150 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
          hasError
            ? "border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]"
            : "border-slate-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(13,148,136,0.1)]",
          className,
        )}
        {...props}
      />
      {hasError && (
        <span id={errorId} className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
});

export default Input;
