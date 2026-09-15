"use client"

import * as React from "react"
import { cn } from "cn"
import { Progress as ProgressPrimitive } from "radix-ui"

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
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  color?: ProgressColor
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all",
          colorClasses[color]
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
