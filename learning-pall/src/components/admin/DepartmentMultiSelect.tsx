"use client";

import { Check } from "lucide-react";
import { DEPARTMENTS, ALL_STAFF_LABEL } from "@/lib/departments";

type Props = {
  value: string[]; // empty array = ALL STAFF
  onChange: (value: string[]) => void;
};

/**
 * Multi-select for admin targeting of content (reels, comms).
 * ALL STAFF is the first option; selecting it clears any specific departments.
 * Selecting any specific department clears ALL STAFF.
 * When `value` is empty, ALL STAFF is considered selected.
 */
export default function DepartmentMultiSelect({ value, onChange }: Props) {
  const isAllStaff = value.length === 0;

  function toggleAllStaff() {
    onChange([]);
  }

  function toggleDepartment(dept: string) {
    if (value.includes(dept)) {
      onChange(value.filter((d) => d !== dept));
    } else {
      onChange([...value, dept]);
    }
  }

  return (
    <div className="bg-vand-black border border-white/15 rounded max-h-64 overflow-y-auto">
      <button
        type="button"
        onClick={toggleAllStaff}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left border-b border-white/10 transition-colors ${
          isAllStaff
            ? "bg-vand-gold/15 text-vand-gold font-medium"
            : "text-vand-sand hover:bg-white/5"
        }`}
      >
        <span
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
            isAllStaff
              ? "bg-vand-gold border-vand-gold text-vand-black"
              : "border-white/20"
          }`}
        >
          {isAllStaff && <Check size={12} strokeWidth={3} />}
        </span>
        {ALL_STAFF_LABEL}
      </button>
      {DEPARTMENTS.map((dept) => {
        const selected = value.includes(dept);
        return (
          <button
            type="button"
            key={dept}
            onClick={() => toggleDepartment(dept)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              selected
                ? "bg-vand-gold/10 text-vand-sand"
                : "text-vand-sand/70 hover:bg-white/5"
            }`}
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                selected
                  ? "bg-vand-gold border-vand-gold text-vand-black"
                  : "border-white/20"
              }`}
            >
              {selected && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="truncate">{dept}</span>
          </button>
        );
      })}
    </div>
  );
}

export function describeTargets(targets: string[]): string {
  if (targets.length === 0) return ALL_STAFF_LABEL;
  if (targets.length === 1) return targets[0];
  if (targets.length <= 3) return targets.join(", ");
  return `${targets.length} departments`;
}
