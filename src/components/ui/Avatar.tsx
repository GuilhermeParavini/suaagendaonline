import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function Avatar({ name, className, ...props }: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#CCFBF1] text-sm font-medium text-[#115E59] select-none",
        className,
      )}
      {...props}
    >
      {initials}
    </div>
  );
}

export default Avatar;
