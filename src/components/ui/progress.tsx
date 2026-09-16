"use client"

import { cn } from "cn"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

const colorClasses = {
  blue: "bg-blue-400",
  green: "bg-green-400",
  red: "bg-red-500",
  orange: "bg-orange-400",
  default: "bg-primary",
} as const

type ProgressColor = keyof typeof colorClasses

function Progress({
  className,
  value,
  color = "default",
  ...props
}: ProgressPrimitive.Root.Props & {
  color?: ProgressColor
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Track className="h-full w-full">
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn(
            "h-full w-full flex-1 transition-all",
            colorClasses[color]
          )}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
