import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SkeletonVariant = "text" | "circular" | "rectangular";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  /** Largura. Numero e tratado como px; string e usada como esta. */
  width?: number | string;
  /** Altura. Numero e tratado como px; string e usada como esta. */
  height?: number | string;
}

const variantClass: Record<SkeletonVariant, string> = {
  text: "rounded",
  circular: "rounded-full",
  rectangular: "rounded-lg",
};

function toCssSize(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Bloco esqueleto com efeito shimmer (definido em globals.css). Por padrao
 * `text` ocupa 100% da largura com 16px de altura — usado no fluxo de texto.
 */
function Skeleton({
  variant = "text",
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps) {
  const altura =
    height === undefined && variant === "text" ? 16 : height;
  const largura = width === undefined && variant !== "circular" ? "100%" : width;

  const styles: CSSProperties = {
    ...style,
    width: toCssSize(largura),
    height: toCssSize(altura),
  };

  return (
    <div
      role="status"
      aria-hidden="true"
      className={cn("sao-skeleton", variantClass[variant], className)}
      style={styles}
      {...props}
    />
  );
}

export default Skeleton;
