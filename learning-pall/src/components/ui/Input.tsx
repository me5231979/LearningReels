"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-sm border border-white/20 bg-white/10 px-4 py-3 text-base text-white placeholder:text-vand-sand/50 focus:border-vand-gold focus:ring-1 focus:ring-vand-gold/50 outline-none transition-colors",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export default Input;
