import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
}

export default function Progress({
  value,
  max = 100,
  className,
  showLabel = false,
}: ProgressProps) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm text-vand-sand/60">Progress</span>
          <span className="text-sm font-medium text-white">
            {percentage}%
          </span>
        </div>
      )}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full vand-gold-gradient rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
