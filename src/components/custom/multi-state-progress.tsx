import { cn } from "@/frontend/utils/utils";

type ProgressColor = "green" | "orange" | "gray" | "default";

interface MultiStateProgressProps {
  segments: {
    value: number;
    color: ProgressColor;
  }[];
  className?: string;
}

export function MultiStateProgress({ segments, className }: MultiStateProgressProps) {
    const colorClasses: Record<ProgressColor, string> = {
        green: "bg-teal-600",
        orange: "bg-orange-500",
        gray: "bg-gray-200",
        default: "bg-primary",
    }

  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary flex",
        className
      )}
    >
      {segments.map((segment, index) => (
        <div
          key={index}
          className={cn("h-full transition-all", colorClasses[segment.color])}
          style={{ width: `${segment.value}%` }}
        />
      ))}
    </div>
  );
}
