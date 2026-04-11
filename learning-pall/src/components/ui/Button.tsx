"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "gold";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-sans font-medium rounded-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vand-gold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
          {
            "bg-vand-sand text-vand-black hover:bg-white":
              variant === "primary",
            "bg-white/10 text-vand-sand border border-white/20 hover:bg-white/15":
              variant === "secondary",
            "text-vand-sand hover:text-white hover:bg-white/10":
              variant === "ghost",
            "vand-gold-gradient text-vand-black font-semibold hover:opacity-90":
              variant === "gold",
          },
          {
            "text-sm px-3 py-1.5": size === "sm",
            "text-base px-5 py-2.5": size === "md",
            "text-lg px-7 py-3.5": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export default Button;
