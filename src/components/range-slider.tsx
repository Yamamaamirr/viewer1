import { useState, useRef, useEffect, useCallback, memo } from "react"
import { Slider } from "@/components/ui/slider"

interface RangeSliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  min: number
  max: number
  step: number
}

const RangeSliderComponent = ({ value, onValueChange, min, max, step }: RangeSliderProps) => {
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Update local value when external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced value change handler
  const handleValueChange = useCallback((newValue: number[]) => {
    // Update local state immediately for responsive UI
    setLocalValue(newValue)
    
    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Apply filter after 300ms of no changes
    debounceRef.current = setTimeout(() => {
      onValueChange(newValue)
    }, 300)
  }, [onValueChange])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Format values based on the range - use more decimals for smaller ranges
  const formatValue = (val: number) => {
    const range = max - min
    if (range < 1) {
      return val.toFixed(3)
    } else if (range < 10) {
      return val.toFixed(2)
    } else if (range < 100) {
      return val.toFixed(1)
    } else {
      return Math.round(val).toString()
    }
  }

  return (
    <div className="relative pt-3 pb-2">
      <Slider 
        value={localValue} 
        onValueChange={handleValueChange} 
        min={min} 
        max={max} 
        step={step} 
      />
      <div className="flex justify-between items-center mt-3">
        <div className="flex items-center space-x-2.5">
          <div className="px-2.5 py-1 bg-gradient-to-r from-[#8187FF]/5 to-[#8187FF]/10 rounded-md border border-[#8187FF]/20 shadow-sm">
            <span className="text-xs font-semibold text-[#8187FF]">{formatValue(localValue[0])}</span>
          </div>
          <div className="flex items-center">
            <div className="w-5 h-0.5 bg-gradient-to-r from-[#8187FF]/30 to-[#8187FF]/50 rounded-full"></div>
          </div>
          <div className="px-2.5 py-1 bg-gradient-to-r from-[#8187FF]/5 to-[#8187FF]/10 rounded-md border border-[#8187FF]/20 shadow-sm">
            <span className="text-xs font-semibold text-[#8187FF]">{formatValue(localValue[1])}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const RangeSlider = memo(RangeSliderComponent)
