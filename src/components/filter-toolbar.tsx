import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react"
import { User, Globe, LogOut, Crop, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/multi-select"
import { RangeSlider } from "@/components/range-slider"
import { Switch } from "@/components/ui/switch"
import type { Filters, FilterKey } from "@/hooks/use-filters"
import type { FilterOption } from "@/types/data"
import { cn } from "@/lib/utils"
import { useData } from "@/contexts/DataContext"
import { DropdownSkeleton } from "@/components/ui/skeleton"

interface FilterToolbarProps {
  filters: Filters
  setFilter: (key: FilterKey, value: any) => void
  resetFilters: () => void
  isFiltered: boolean
  getComprehensiveOptions: () => any
  isMapLoading?: boolean
  isExtentActive?: boolean
  setIsExtentActive?: (active: boolean) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const filterSections = [
  {
    id: "pipeline",
    label: "Pipeline",
    filters: [
      { key: "businessUnit", label: "Business Unit", type: "multiselect" },
      { key: "systemName", label: "System Name", type: "multiselect" },
      { key: "pipelineName", label: "Pipeline Name", type: "multiselect" },
      { key: "routeNumber", label: "Route Number", type: "multiselect" },
      { key: "pix", label: "PIX", type: "multiselect" },
      { key: "riverCrossingId", label: "River Crossing ID", type: "multiselect" },
    ],
  },
  {
    id: "hydrology",
    label: "Hydrology",
    filters: [
      { key: "gnisName", label: "Waterway name", type: "multiselect" },
      { key: "streamOrder", label: "Stream Order", type: "multiselect" },
      { key: "flow", label: "Flow (cfs)", type: "slider" },
      { key: "velocity", label: "Velocity (fps)", type: "slider" },
    ],
  },
]

const FilterToolbarComponent = ({ filters, setFilter, resetFilters: _resetFilters, isFiltered: _isFiltered, getComprehensiveOptions, isMapLoading, isExtentActive = false, setIsExtentActive, isCollapsed = false, onToggleCollapse }: FilterToolbarProps) => {
  const { processedData, loading } = useData()
  const [activeSection, setActiveSection] = useState<string>("pipeline")
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Debounce filter changes for comprehensive options
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 100) // Reduced from 200ms for better responsiveness

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [filters])

  // Get comprehensive filter options that update based on debounced selections
  const comprehensiveOptions = useMemo(() => {
    if (!processedData) return {}
    
    // Only recalculate when debounced filters actually change
    try {
      return getComprehensiveOptions() || {}
    } catch (error) {
      console.warn('Error calculating comprehensive options:', error)
      return {}
    }
  }, [getComprehensiveOptions, processedData, debouncedFilters]) // Use debounced filters

  // Get filter options from processed data and comprehensive options
  const multiSelectOptions = useMemo(() => {
    if (!processedData) return {}
    
    // Use comprehensive options for all filter types - no more limiting since MultiSelect handles lazy loading
    return {
      businessUnit: comprehensiveOptions.businessUnit || processedData.filterOptions.businessUnit,
      systemName: comprehensiveOptions.systemName || processedData.filterOptions.systemName,
      pipelineName: comprehensiveOptions.pipelineName || processedData.filterOptions.pipelineName,
      routeNumber: comprehensiveOptions.routeNumber || processedData.filterOptions.routeNumber,
      pix: comprehensiveOptions.pix || processedData.filterOptions.pix,
      riverCrossingId: comprehensiveOptions.riverCrossingId || processedData.filterOptions.riverCrossingId,
      streamOrder: comprehensiveOptions.streamOrder || processedData.filterOptions.streamOrder,
      gnisName: comprehensiveOptions.gnisName || processedData.filterOptions.gnisName,
    }
  }, [processedData, comprehensiveOptions])

  // Get dynamic slider configurations from comprehensive options or processed data
  const sliderConfigs = useMemo(() => {
    let ranges = processedData?.dynamicRanges
    
    // Use updated ranges from comprehensive filtering if available
    if (comprehensiveOptions.dynamicRanges) {
      ranges = comprehensiveOptions.dynamicRanges
    }
    
    if (!ranges) {
      return {
        flow: { min: 0, max: 100, step: 0.1 },
        velocity: { min: 0, max: 50, step: 0.1 },
      }
    }

    const { flow, velocity } = ranges
    
    // Helper function to create valid slider config
    const createSliderConfig = (range: [number, number]) => {
      const [minVal, maxVal] = range
      
      // Handle edge cases
      if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
        return { min: 0, max: 100, step: 0.1 }
      }
      
      // Handle case where min equals max (single data point)
      if (Math.abs(maxVal - minVal) < 0.001) {
        const center = minVal
        const padding = Math.max(0.1, Math.abs(center) * 0.1) // 10% padding or minimum 0.1
        return {
          min: center - padding,
          max: center + padding,
          step: padding / 10
        }
      }
      
      // Handle case where min > max
      const actualMin = Math.min(minVal, maxVal)
      const actualMax = Math.max(minVal, maxVal)
      const rangeSize = actualMax - actualMin
      
      // Calculate appropriate step size
      let step: number
      if (rangeSize < 1) {
        step = Math.max(0.001, rangeSize / 100) // At least 100 steps, minimum 0.001
      } else if (rangeSize < 10) {
        step = Math.max(0.01, rangeSize / 100)
      } else if (rangeSize < 100) {
        step = Math.max(0.1, rangeSize / 100)
      } else {
        step = Math.max(1, rangeSize / 100)
      }
      
      // Round step to a reasonable precision
      if (step < 1) {
        const precision = Math.max(0, Math.ceil(-Math.log10(step)) + 1)
        step = Number(step.toFixed(precision))
      } else {
        step = Math.round(step * 10) / 10
      }
      
      return {
        min: actualMin,
        max: actualMax,
        step: step
      }
    }
    
    return {
      flow: createSliderConfig(flow),
      velocity: createSliderConfig(velocity)
    }
  }, [processedData?.dynamicRanges, comprehensiveOptions.dynamicRanges])

  // Store previous slider configs to detect changes and preserve values
  const prevSliderConfigs = useRef(sliderConfigs)
  
  // Handle slider range changes intelligently
  useEffect(() => {
    const prev = prevSliderConfigs.current
    const current = sliderConfigs
    
    // Check if ranges have changed significantly
    const flowRangeChanged = Math.abs(prev.flow.min - current.flow.min) > 0.01 || 
                            Math.abs(prev.flow.max - current.flow.max) > 0.01
    const velocityRangeChanged = Math.abs(prev.velocity.min - current.velocity.min) > 0.01 || 
                                Math.abs(prev.velocity.max - current.velocity.max) > 0.01
    
    if (flowRangeChanged || velocityRangeChanged) {
      // Only adjust slider values if they're completely outside the new valid range
      const currentFlow = filters.flow
      const currentVelocity = filters.velocity
      
      // For flow slider
      if (flowRangeChanged && Array.isArray(currentFlow) && currentFlow.length === 2) {
        const [flowMin, flowMax] = currentFlow
        const newFlowConfig = current.flow
        
        // Only adjust if current values are completely outside new range
        const needsFlowAdjustment = flowMax < newFlowConfig.min || flowMin > newFlowConfig.max
        
        if (needsFlowAdjustment) {
          // Preserve user intent: if they were at the extremes, keep them there
          const wasAtMin = Math.abs(flowMin - prev.flow.min) < 0.01
          const wasAtMax = Math.abs(flowMax - prev.flow.max) < 0.01
          
          const newMin = wasAtMin ? newFlowConfig.min : Math.max(newFlowConfig.min, flowMin)
          const newMax = wasAtMax ? newFlowConfig.max : Math.min(newFlowConfig.max, flowMax)
          
          setFilter('flow', [newMin, newMax])
        }
      }
      
      // For velocity slider
      if (velocityRangeChanged && Array.isArray(currentVelocity) && currentVelocity.length === 2) {
        const [velocityMin, velocityMax] = currentVelocity
        const newVelocityConfig = current.velocity
        
        // Only adjust if current values are completely outside new range
        const needsVelocityAdjustment = velocityMax < newVelocityConfig.min || velocityMin > newVelocityConfig.max
        
        if (needsVelocityAdjustment) {
          // Preserve user intent: if they were at the extremes, keep them there
          const wasAtMin = Math.abs(velocityMin - prev.velocity.min) < 0.01
          const wasAtMax = Math.abs(velocityMax - prev.velocity.max) < 0.01
          
          const newMin = wasAtMin ? newVelocityConfig.min : Math.max(newVelocityConfig.min, velocityMin)
          const newMax = wasAtMax ? newVelocityConfig.max : Math.min(newVelocityConfig.max, velocityMax)
          
          setFilter('velocity', [newMin, newMax])
        }
      }
    }
    
    // Update ref for next comparison
    prevSliderConfigs.current = current
  }, [sliderConfigs, filters.flow, filters.velocity, setFilter])

  const toggleSection = useCallback((sectionId: string) => {
    setActiveSection(sectionId)
  }, [])

  const getSectionActiveFilters = useCallback((section: any) => {
    return section.filters.filter((filter: any) => {
      const value = filters[filter.key as FilterKey]
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === "object" && value !== null) {
        return (value as any).min !== "" || (value as any).max !== ""
      }
      if (typeof value === "boolean") return value === true
      return value !== "" && value !== undefined
    }).length
  }, [filters])

  // Memoize filter change handlers to prevent recreation
  const handleRangeInputChange = useCallback((key: FilterKey, field: 'min' | 'max', value: string) => {
    setFilter(key, {
      ...(filters[key] as any),
      [field]: value,
    })
  }, [filters, setFilter])

  // Section-specific reset functions
  const resetPipelineFilters = useCallback(() => {
    setFilter("businessUnit", [])
    setFilter("systemName", [])
    setFilter("pipelineName", [])
    setFilter("routeNumber", [])
    setFilter("pix", [])
    setFilter("riverCrossingId", [])
  }, [setFilter])

  const resetHydrologyFilters = useCallback(() => {
    setFilter("gnisName", [])
    setFilter("streamOrder", [])
    // Reset sliders to their current available range based on other active filters
    const currentRanges = comprehensiveOptions.dynamicRanges || processedData?.dynamicRanges
    if (currentRanges) {
      setFilter("flow", currentRanges.flow)
      setFilter("velocity", currentRanges.velocity)
    }
  }, [setFilter, comprehensiveOptions.dynamicRanges, processedData?.dynamicRanges])

  const renderFilter = useCallback((filter: any) => {
    if ((isMapLoading || loading) || !multiSelectOptions) {
      return <DropdownSkeleton />
    }

    switch (filter.type) {
      case "multiselect":
        const options = (multiSelectOptions[filter.key as keyof typeof multiSelectOptions] || []) as FilterOption[]
        
        // Show message when no options available due to comprehensive filtering
        if (options.length === 0) {
          return (
            <div className="text-xs text-gray-500 italic p-2 bg-gray-50 rounded border">
              No {filter.label.toLowerCase()} options available for current selection
            </div>
          )
        }

        // Show helpful hints for better UX
        let placeholder = `Select ${filter.label.toLowerCase()}...`
        if (options.length === 0) {
          placeholder = `No ${filter.label.toLowerCase()} available`
        } else if (options.length < 5) {
          placeholder = `${options.length} ${filter.label.toLowerCase()} available`
        }

        return (
          <MultiSelect
            options={options}
            selected={filters[filter.key as FilterKey] as string[]}
            onChange={(value) => setFilter(filter.key as FilterKey, value)}
            placeholder={placeholder}
          />
        )
      case "range-input":
        const rangeValue = filters[filter.key as FilterKey] as any
        return (
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              placeholder="Min"
              value={rangeValue.min}
              onChange={(e) => handleRangeInputChange(filter.key as FilterKey, 'min', e.target.value)}
              className="text-xs"
            />
            <span className="text-gray-400 text-xs">–</span>
            <Input
              type="number"
              placeholder="Max"
              value={rangeValue.max}
              onChange={(e) => handleRangeInputChange(filter.key as FilterKey, 'max', e.target.value)}
              className="text-xs"
            />
          </div>
        )
      case "input":
        const inputValue = filters[filter.key as FilterKey];
        return (
          <Input
            placeholder={`Search by ${filter.label.toLowerCase()}...`}
            value={typeof inputValue === 'string' ? inputValue : ''}
            onChange={(e) => setFilter(filter.key as FilterKey, e.target.value)}
            className="text-xs"
          />
        )
      case "slider":
        const sliderConfig = sliderConfigs[filter.key as keyof typeof sliderConfigs]
        const currentValue = filters[filter.key as FilterKey] as number[]
        
        // Use current values as-is without clamping to prevent jumping
        // The RangeSlider component will handle edge cases internally
        let sliderValue = currentValue
        if (!Array.isArray(currentValue) || currentValue.length !== 2) {
          // If empty array or invalid, use the full range (no filtering)
          sliderValue = [sliderConfig.min, sliderConfig.max]
        }
        
        return (
          <RangeSlider
            value={sliderValue}
            onValueChange={(value) => setFilter(filter.key as FilterKey, value)}
            {...sliderConfig}
          />
        )

      default:
        return null
    }
  }, [filters, setFilter, handleRangeInputChange, loading, multiSelectOptions, sliderConfigs, isMapLoading])

  // Check if sliders are at default values
  const areSlidersAtDefault = useMemo(() => {
    if (!processedData?.dynamicRanges) return true
    
    const { flow: defaultFlow, velocity: defaultVelocity } = processedData.dynamicRanges
    const currentFlow = filters.flow
    const currentVelocity = filters.velocity
    
    // If either array is empty, consider it default (not filtered)
    if (currentFlow.length === 0 || currentVelocity.length === 0) return true
    
    const flowAtDefault = currentFlow.length === 2 && 
      Math.abs(currentFlow[0] - defaultFlow[0]) < 0.01 && 
      Math.abs(currentFlow[1] - defaultFlow[1]) < 0.01
    
    const velocityAtDefault = currentVelocity.length === 2 && 
      Math.abs(currentVelocity[0] - defaultVelocity[0]) < 0.01 && 
      Math.abs(currentVelocity[1] - defaultVelocity[1]) < 0.01
    
    return flowAtDefault && velocityAtDefault
  }, [filters.flow, filters.velocity, processedData?.dynamicRanges])

  // Custom section active filters calculation
  const getSectionActiveFiltersCustom = useCallback((section: any) => {
    if (section.id === "hydrology") {
      // For hydrology, exclude sliders if they're at default values
      const nonSliderFilters = section.filters.filter((filter: any) => filter.type !== "slider")
      
      const nonSliderActiveCount = nonSliderFilters.filter((filter: any) => {
        const value = filters[filter.key as FilterKey]
        if (Array.isArray(value)) return value.length > 0
        if (typeof value === "boolean") return value === true
        return value !== "" && value !== undefined
      }).length
      
      // Only evaluate slider activity after dynamic ranges are loaded to prevent initial flicker
      const dynamicRangesLoaded = Boolean(processedData?.dynamicRanges)
      const sliderActiveCount = dynamicRangesLoaded && !areSlidersAtDefault ? 2 : 0
      
      return nonSliderActiveCount + sliderActiveCount
    }
    
    // For other sections, use the original logic
    return getSectionActiveFilters(section)
  }, [filters, getSectionActiveFilters, areSlidersAtDefault, processedData?.dynamicRanges])

  // Memoize section active filters to prevent recalculation
  const sectionActiveFilters = useMemo(() => {
    return filterSections.reduce((acc, section) => {
      acc[section.id] = getSectionActiveFiltersCustom(section)
      return acc
    }, {} as Record<string, number>)
  }, [getSectionActiveFiltersCustom])

  if (isCollapsed) {
    return (
      <aside className="w-12 bg-[#fcfcfc] text-gray-800 flex flex-col h-full border-r border-gray-200 shadow-sm z-30 transition-all duration-300 ease-in-out">
        {/* Collapsed Header */}
        <div className="p-2 h-16 flex items-center justify-center border-b border-gray-300/80 shrink-0 bg-gray-100 relative overflow-hidden shadow-sm">
          <div className="p-2 bg-gradient-to-br from-[#8187FF] via-[#6B73E6] to-[#5A64D9] rounded-lg shadow-md shadow-[#8187FF]/20 ring-1 ring-white/15">
            <Filter className="h-3 w-3 text-white drop-shadow-sm" />
          </div>
        </div>

        {/* Collapsed Tab Indicators */}
        <div className="flex flex-col">
          {filterSections.map((section) => {
            const activeFilters = sectionActiveFilters[section.id];
            return (
              <div
                key={section.id}
                className={cn(
                  "h-8 border-b border-gray-200 flex items-center justify-center relative",
                  activeSection === section.id ? "bg-[#8187FF]/10 border-l-2 border-l-[#8187FF]" : "hover:bg-gray-50"
                )}
              >
                {activeFilters > 0 && (
                  <div className="w-2 h-2 bg-[#8187FF] rounded-full"></div>
                )}
              </div>
            );
          })}
        </div>

        {/* Expand Button */}
        <div className="mt-auto p-2">
          <button
            onClick={onToggleCollapse}
            className="w-full p-2 bg-gradient-to-br from-[#8187FF] via-[#6B73E6] to-[#5A64D9] rounded-lg shadow-md shadow-[#8187FF]/20 ring-1 ring-white/15 hover:shadow-lg transition-all duration-200 group"
            title="Expand Filters"
          >
            <ChevronRight className="h-3 w-3 text-white drop-shadow-sm group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-[350px] bg-[#fcfcfc] text-gray-800 flex flex-col h-full border-r border-gray-200 shadow-sm z-30 transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="p-3 h-16 flex items-center border-b border-gray-300/80 shrink-0 bg-gray-100 relative overflow-hidden shadow-sm">
        {/* Background decorative element */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#8187FF]/5 to-transparent rounded-full -translate-y-5 translate-x-5"></div>
        <div className="flex items-center justify-between w-full relative z-10">
          <div className="flex items-center">
            <div className="relative">
              <div className="p-2 bg-gradient-to-br from-[#8187FF] via-[#6B73E6] to-[#5A64D9] rounded-lg shadow-md shadow-[#8187FF]/20 ring-1 ring-white/15">
                <Globe className="h-4 w-4 text-white drop-shadow-sm" />
              </div>
            </div>
            <div className="ml-3">
              <h1 className="text-sm font-medium text-gray-800 tracking-wide">Earthbound AI</h1>
            </div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-gray-200/60 rounded-lg transition-all duration-200 group"
            title="Collapse Filters"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-gray-600 group-hover:text-gray-800 group-hover:scale-110 transition-all" />
          </button>
        </div>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="px-0 bg-white border-b border-gray-200">
        <div className="flex">
          {filterSections.map((section) => {
            const isActive = activeSection === section.id;
            const activeFilters = sectionActiveFilters[section.id];
            
            return (
              <button
                key={section.id}
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex-1 min-w-[100px] py-2.5 text-xs font-medium text-center focus:outline-none relative",
                  "border-b-2 transition-colors flex items-center justify-center",
                  isActive 
                    ? "text-[#8187FF] border-[#8187FF] bg-[#8187FF]/10" 
                    : "text-gray-500 border-transparent hover:bg-gray-50"
                )}
              >
                <span>{section.label}</span>
                {/* Always reserve space for badge - show visible badge or invisible placeholder */}
                <span
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-normal px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  activeFilters > 0 
                      ? isActive
                        ? "bg-[#8187FF]/10 text-[#8187FF]" 
                        : "bg-gray-100 text-gray-500"
                      : "invisible"
                  )}
                >
                  {activeFilters > 0 ? activeFilters : "0"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Sections */}
      <div
        className="flex-1 overflow-y-auto bg-gray-50"
        style={{
          willChange: "transform",
          WebkitOverflowScrolling: "touch",
          transform: "translateZ(0)",
        }}
      >
        <div className="p-2 space-y-2">
          {(() => {
            const activeFilterSection = filterSections.find(section => section.id === activeSection)
            if (!activeFilterSection) return null

            return (
              <>
                <div className="bg-white rounded-lg border border-gray-200 transition-all duration-200 shadow-md mt-1">
                  <div className="p-1.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-sm text-gray-900 tracking-tight uppercase pl-2">{activeFilterSection.label}</h3>
                        {sectionActiveFilters[activeSection] > 0 && (
                          <span className="text-xs font-medium text-white bg-[#8187FF] px-1.5 py-0.5 rounded shadow-sm">
                            {sectionActiveFilters[activeSection]}
                          </span>
                        )}
                      </div>
                      {sectionActiveFilters[activeSection] > 0 && (
                        <button
                          onClick={() => {
                            if (activeSection === "pipeline") {
                              resetPipelineFilters()
                            } else if (activeSection === "hydrology") {
                              resetHydrologyFilters()
                            }
                          }}
                          className="font-bold uppercase tracking-wide text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 bg-transparent border-none shadow-none transition-colors duration-150 focus:outline-none"
                          style={{ letterSpacing: '0.04em' }}
                          title={`Clear all ${activeFilterSection.label.toLowerCase()} filters`}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 mb-2"></div>
                    <div className="space-y-1.5">
                      {activeFilterSection.filters.map((filter, filterIndex) => {
                        const isLast = filterIndex === activeFilterSection.filters.length - 1;
                        return (
                          <div key={filter.key} className={cn("space-y-1 pl-2", isLast ? "pb-1" : "")}>
                            {filterIndex > 0 && (
                              <div className="h-px bg-gradient-to-r from-transparent via-gray-200/80 to-transparent my-1.5" />
                            )}
                            <Label className="text-xs font-semibold text-gray-700 tracking-wide uppercase">{filter.label}</Label>
                            {renderFilter(filter)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>


              </>
            )
          })()}
        </div>
      </div>

      {/* Map Extent Toggle */}
      {setIsExtentActive && (
        <div className="px-2 py-2 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-[#8187FF] to-[#6B73E6] rounded-full flex items-center justify-center shadow-sm">
                <Crop className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800">
                  Filter by Map Extent
                </p>
                <p className="text-xs text-gray-500">
                  Show only points within current map view
                </p>
              </div>
            </div>
            <Switch
              checked={isExtentActive}
              onCheckedChange={setIsExtentActive}
              className="data-[state=checked]:bg-[#8187FF]"
            />
          </div>
        </div>
      )}

      {/* User Account Preview */}
      <div className="px-2 py-2 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all duration-150 cursor-pointer group">
          <div className="w-6 h-6 bg-gradient-to-br from-[#8187FF] to-[#6B73E6] rounded-full flex items-center justify-center shadow-sm">
            <User className="h-3 w-3 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate group-hover:text-gray-900 transition-colors">
              Guest User
            </p>
            <p className="text-xs text-gray-500 truncate">guest@earthbound.ai</p>
          </div>
          <LogOut className="h-3 w-3 text-gray-500 hover:text-[#8187FF] cursor-pointer transition-colors" />
        </div>
      </div>
    </aside>
  )
}

export const FilterToolbar = memo(FilterToolbarComponent)
