import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "bordered";
}

export default function Card({
  className,
  variant = "default",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-sm p-6",
        {
          "bg-white/5": variant === "default",
          "bg-white/5 shadow-lg shadow-black/30": variant === "elevated",
          "bg-white/5 border border-white/10": variant === "bordered",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
