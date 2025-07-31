"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-gradient-to-r from-gray-100 via-gray-150 to-gray-200 shadow-inner">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-[#8187FF] via-[#6B73E6] to-[#5A64D9] rounded-full shadow-sm" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-white bg-gradient-to-br from-[#8187FF] via-[#6B73E6] to-[#5A64D9] shadow-md ring-1 ring-[#8187FF]/20 ring-offset-1 ring-offset-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8187FF]/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 hover:ring-3 hover:ring-[#8187FF]/25 hover:shadow-lg hover:scale-105 active:scale-95" />
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-white bg-gradient-to-br from-[#8187FF] via-[#6B73E6] to-[#5A64D9] shadow-md ring-1 ring-[#8187FF]/20 ring-offset-1 ring-offset-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8187FF]/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 hover:ring-3 hover:ring-[#8187FF]/25 hover:shadow-lg hover:scale-105 active:scale-95" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
