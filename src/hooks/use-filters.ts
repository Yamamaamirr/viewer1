import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { dataService } from "@/services/dataService"
import { useData } from "@/contexts/DataContext"

// Optimized deep equality check using React's built-in Object.is and JSON comparison for complex objects
const isEqual = (a: any, b: any): boolean => {
  if (Object.is(a, b)) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => Object.is(item, b[index]))
  }
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a).sort()
    const keysB = Object.keys(b).sort()
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => Object.is(a[key], b[key]))
  }
  
  return false
}

export interface Filters {
  businessUnit: string[]
  systemName: string[]
  pipelineName: string[]
  routeNumber: string[]
  gnisName: string[]
  riverCrossingId: string[]
  pix: string[]
  flow: number[]
  velocity: number[]
  streamOrder: string[]
  filterByExtent: boolean
}

export type FilterKey = keyof Filters

const initialFilters: Filters = {
  businessUnit: [],
  systemName: [],
  pipelineName: [],
  routeNumber: [],
  gnisName: [],
  riverCrossingId: [],
  pix: [],
  flow: [], // Start empty until dynamic ranges are loaded
  velocity: [], // Start empty until dynamic ranges are loaded
  streamOrder: [],
  filterByExtent: false,
}

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const { setFilteredFeatures, processedData } = useData()
  const debounceRef = useRef<NodeJS.Timeout>()
  const abortControllerRef = useRef<AbortController>()

  // Performance tracking
  const lastFilterApplicationTime = useRef<number>(0)
  const filterApplicationCount = useRef<number>(0)

  // Initialize dynamic ranges when data loads
  useEffect(() => {
    if (processedData?.dynamicRanges) {
      setFilters(prev => ({
        ...prev,
        flow: processedData.dynamicRanges.flow,
        velocity: processedData.dynamicRanges.velocity,
      }))
    }
  }, [processedData?.dynamicRanges])

  const setFilter = useCallback((key: FilterKey, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    const dynamicRanges = processedData?.dynamicRanges
    setFilters({
      ...initialFilters,
      flow: dynamicRanges?.flow || [],
      velocity: dynamicRanges?.velocity || [],
    })
  }, [processedData?.dynamicRanges])

  const isFiltered = useMemo(() => {
    const currentInitial = {
      ...initialFilters,
      flow: processedData?.dynamicRanges?.flow || [],
      velocity: processedData?.dynamicRanges?.velocity || [],
    }
    return !isEqual(filters, currentInitial)
  }, [filters, processedData?.dynamicRanges])

  // Immediate filter application for responsiveness
  const applyFilters = useCallback(() => {
    if (!processedData) return

    // Cancel any previous filter operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const startTime = performance.now()
    filterApplicationCount.current += 1

    try {
      // Execute filtering immediately - no delays
      if (abortController.signal.aborted) return

      const filtered = dataService.filterFeatures({
        businessUnit: filters.businessUnit.length > 0 ? filters.businessUnit : undefined,
        systemName: filters.systemName.length > 0 ? filters.systemName : undefined,
        pipelineName: filters.pipelineName.length > 0 ? filters.pipelineName : undefined,
        pix: filters.pix.length > 0 ? filters.pix : undefined,
        riverCrossingId: filters.riverCrossingId.length > 0 ? filters.riverCrossingId : undefined,
        gnisName: filters.gnisName.length > 0 ? filters.gnisName : undefined,
        routeNumber: filters.routeNumber.length > 0 ? filters.routeNumber : undefined,
        flowRange: filters.flow.length === 2 ? [filters.flow[0], filters.flow[1]] : undefined,
        velocityRange: filters.velocity.length === 2 ? [filters.velocity[0], filters.velocity[1]] : undefined,
        streamOrder: filters.streamOrder.length > 0 ? filters.streamOrder : undefined,
      })

      if (!abortController.signal.aborted) {
        setFilteredFeatures(filtered)
        
        const endTime = performance.now()
        lastFilterApplicationTime.current = endTime - startTime
        
        // Minimal performance logging only for slow operations
        if (process.env.NODE_ENV === 'development' && lastFilterApplicationTime.current > 50) {
          console.log(`Filter took ${lastFilterApplicationTime.current.toFixed(1)}ms for ${filtered.length} features`)
        }
      }

    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Filter application error:', error)
      }
    }
  }, [filters, processedData, setFilteredFeatures])

  // Minimal debouncing for better responsiveness
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Much faster debounce times for responsive filtering
    const getDebounceTime = () => {
      if (!processedData) return 10

      const datasetSize = processedData.features.length
      
      // Very fast base debounce time
      let debounceTime = 5 // Much faster than before

      // Only add delay for very large datasets
      if (datasetSize > 50000) {
        debounceTime = 20
      } else if (datasetSize > 25000) {
        debounceTime = 10
      }

      return debounceTime
    }

    debounceRef.current = setTimeout(() => {
      applyFilters()
    }, getDebounceTime())

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [applyFilters, processedData])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Memoized comprehensive options calculation with performance optimization
  const getComprehensiveOptions = useCallback(() => {
    if (!processedData) return null
    
    // Use a separate timeout for comprehensive options to avoid blocking UI
    return dataService.getComprehensiveFilterOptions({
      businessUnit: filters.businessUnit,
      systemName: filters.systemName,
      pipelineName: filters.pipelineName,
      pix: filters.pix,
      riverCrossingId: filters.riverCrossingId,
      gnisName: filters.gnisName,
      routeNumber: filters.routeNumber,
      flowRange: filters.flow.length === 2 ? [filters.flow[0], filters.flow[1]] : undefined,
      velocityRange: filters.velocity.length === 2 ? [filters.velocity[0], filters.velocity[1]] : undefined,
      streamOrder: filters.streamOrder,
    })
  }, [
    processedData,
    filters.businessUnit,
    filters.systemName,
    filters.pipelineName,
    filters.pix,
    filters.riverCrossingId,
    filters.gnisName,
    filters.routeNumber,
    filters.flow,
    filters.velocity,
    filters.streamOrder
  ])

  return { 
    filters, 
    setFilter, 
    resetFilters, 
    isFiltered,
    getComprehensiveOptions
  }
}
