import type { PipelineDataCollection, PipelineFeature, ProcessedData, FilterOption } from "@/types/data"
import rawData from "../../hydrotechnical/samples/all-indexes.json"

// Unit conversion constants
const M3_TO_CFS = 35.314666212661 // Convert m³/s to cubic feet per second
const MS_TO_FPS = 3.28084 // Convert m/s to feet per second

interface FilterCriteria {
  businessUnit?: string[]
  systemName?: string[]
  pipelineName?: string[]
  pix?: string[]
  riverCrossingId?: string[]
  gnisName?: string[]
  routeNumber?: string[]
  flowRange?: [number, number]
  velocityRange?: [number, number]
  streamOrder?: string[]
}

class DataService {
  private data: PipelineDataCollection
  private processedData: ProcessedData | null = null
  
  // Performance optimization indexes
  private indexes: Map<string, Map<string, PipelineFeature[]>> = new Map()
  private rangeIndexes: Map<string, { min: number, max: number, values: number[] }> = new Map()
  private comprehensiveOptionsCache: Map<string, any> = new Map()
  private filteredFeaturesCache: Map<string, PipelineFeature[]> = new Map()
  private isIndexesBuilt = false

  constructor() {
    this.data = rawData as PipelineDataCollection
    this.buildIndexes()
  }

  /**
   * Build performance indexes for fast data access
   */
  private buildIndexes(): void {
    if (this.isIndexesBuilt) return

    console.time('Building indexes')
    const features = this.getFeatures()
    
    // Build hash indexes for categorical filters
    const indexKeys = [
      'business_unit', 
      'system_name', 
      'pipeline_name', 
      'pix', 
      'riverCrossingId', 
      'route_number', 
      'gnis_name'
    ]
    
    indexKeys.forEach(key => {
      const index = new Map<string, PipelineFeature[]>()
      features.forEach(feature => {
        const value = this.getNestedValue(feature, key)
        if (value !== null && value !== undefined && value !== '') {
          if (!index.has(value)) {
            index.set(value, [])
          }
          index.get(value)!.push(feature)
        }
      })
      this.indexes.set(key, index)
    })

    // Build range indexes for numeric filters with sorted values for efficient range queries
    const flowValues = features.map(f => this.convertQemaToCfs(f.qema)).sort((a, b) => a - b)
    const velocityValues = features.map(f => this.convertVemaToFps(f.vema)).sort((a, b) => a - b)
    
    this.rangeIndexes.set('flow', {
      min: flowValues[0],
      max: flowValues[flowValues.length - 1],
      values: flowValues
    })
    
    this.rangeIndexes.set('velocity', {
      min: velocityValues[0],
      max: velocityValues[velocityValues.length - 1],
      values: velocityValues
    })

    this.isIndexesBuilt = true
    console.timeEnd('Building indexes')
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): string {
    const keys = {
      'business_unit': 'business_unit',
      'system_name': 'system_name',
      'pipeline_name': 'pipeline_name',
      'pix': 'pix',
      'riverCrossingId': 'riverCrossingId',
      'route_number': 'route_number',
      'gnis_name': 'gnis_name'
    }
    
    const actualKey = keys[path as keyof typeof keys] || path
    return obj[actualKey] || ''
  }

  /**
   * Generate cache key for memoization - optimized for performance
   */
  private generateCacheKey(filters: FilterCriteria): string {
    // Use more efficient serialization instead of JSON.stringify
    const parts = [
      filters.businessUnit?.sort().join(',') || '',
      filters.systemName?.sort().join(',') || '',
      filters.pipelineName?.sort().join(',') || '',
      filters.pix?.sort().join(',') || '',
      filters.riverCrossingId?.sort().join(',') || '',
      filters.gnisName?.sort().join(',') || '',
      filters.routeNumber?.sort().join(',') || '',
      filters.flowRange?.join('-') || '',
      filters.velocityRange?.join('-') || '',
      filters.streamOrder?.sort().join(',') || ''
    ]
    return parts.join('|')
  }

  /**
   * Get intersection of feature arrays efficiently
   */
  private intersectFeatures(arrays: PipelineFeature[][]): PipelineFeature[] {
    if (arrays.length === 0) return []
    if (arrays.length === 1) return arrays[0]

    // Find smallest array to minimize comparisons
    const sortedArrays = arrays.sort((a, b) => a.length - b.length)
    const [smallest, ...rest] = sortedArrays

    // Use Set for O(1) lookups
    const pixSets = rest.map(arr => new Set(arr.map(f => f.pix)))
    
    return smallest.filter(feature => 
      pixSets.every(pixSet => pixSet.has(feature.pix))
    )
  }

  /**
   * Get all pipeline features
   */
  getFeatures(): PipelineFeature[] {
    // Transform and enrich the raw data to match our interface
    return this.data.features.map(feature => ({
      ...feature,
      // Use actual field names from the data structure
      riverCrossingId: feature.RCID || null,
      history_max: feature.history_max || null,
      // Handle missing data with null instead of fallbacks
      pipeline_name: feature.pipeline_name || null,
      system_name: feature.system_name || null,
      gnis_name: feature.gnis_name || null,
    }))
  }

  /**
   * Convert QEMA (m³/s) to flow in CFS
   */
  private convertQemaToCfs(qema: number): number {
    return qema * M3_TO_CFS
  }

  /**
   * Convert VEMA (m/s) to velocity in FPS
   */
  private convertVemaToFps(vema: number): number {
    return vema * MS_TO_FPS
  }

  /**
   * Calculate dynamic ranges for numeric filters
   */
  private calculateDynamicRanges(): { flow: [number, number], velocity: [number, number] } {
    const flowIndex = this.rangeIndexes.get('flow')!
    const velocityIndex = this.rangeIndexes.get('velocity')!
    
    return {
      flow: [Math.floor(flowIndex.min * 100) / 100, Math.ceil(flowIndex.max * 100) / 100],
      velocity: [Math.floor(velocityIndex.min * 100) / 100, Math.ceil(velocityIndex.max * 100) / 100]
    }
  }

  /**
   * Optimized filtering using indexes for maximum performance
   */
  filterFeatures(filters: FilterCriteria): PipelineFeature[] {
    const cacheKey = this.generateCacheKey(filters)
    
    // Check cache first
    if (this.filteredFeaturesCache.has(cacheKey)) {
      return this.filteredFeaturesCache.get(cacheKey)!
    }

    console.time(`Filtering ${this.getFeatures().length} features`)
    
    let candidateArrays: PipelineFeature[][] = []
    let useIndexes = true

    // Apply categorical filters using indexes
    const categoryFilters = [
      { key: 'business_unit', values: filters.businessUnit },
      { key: 'system_name', values: filters.systemName },
      { key: 'pipeline_name', values: filters.pipelineName },
      { key: 'pix', values: filters.pix },
      { key: 'riverCrossingId', values: filters.riverCrossingId },
      { key: 'route_number', values: filters.routeNumber },
      { key: 'gnis_name', values: filters.gnisName }
    ]

    // Collect features from indexes
    for (const filter of categoryFilters) {
      if (filter.values?.length) {
        const index = this.indexes.get(filter.key)
        if (index) {
          const matchingFeatures = filter.values.flatMap(value => index.get(value) || [])
          if (matchingFeatures.length > 0) {
            candidateArrays.push(matchingFeatures)
          }
        }
      }
    }

    // Start with intersected results or all features
    let filtered: PipelineFeature[]
    if (candidateArrays.length > 0) {
      filtered = this.intersectFeatures(candidateArrays)
    } else {
      filtered = this.getFeatures()
      useIndexes = false
    }

    // Apply range filters
    if (filters.flowRange) {
      const [min, max] = filters.flowRange
      if (useIndexes && filtered.length < 10000) {
        // For smaller sets, direct filtering is faster
        filtered = filtered.filter(f => {
          const flowCfs = this.convertQemaToCfs(f.qema)
          return flowCfs >= min && flowCfs <= max
        })
      } else {
        // For large sets, use binary search on sorted range index
        const flowIndex = this.rangeIndexes.get('flow')!
        const allFeatures = this.getFeatures()
        const minIndex = this.binarySearchLeft(flowIndex.values, min)
        const maxIndex = this.binarySearchRight(flowIndex.values, max)
        
        const rangeFilteredPixSet = new Set(
          allFeatures
            .slice(minIndex, maxIndex + 1)
            .filter(f => {
              const flowCfs = this.convertQemaToCfs(f.qema)
              return flowCfs >= min && flowCfs <= max
            })
            .map(f => f.pix)
        )
        
        filtered = useIndexes 
          ? filtered.filter(f => rangeFilteredPixSet.has(f.pix))
          : allFeatures.filter(f => rangeFilteredPixSet.has(f.pix))
      }
    }

    if (filters.velocityRange) {
      const [min, max] = filters.velocityRange
      filtered = filtered.filter(f => {
        const velocityFps = this.convertVemaToFps(f.vema)
        return velocityFps >= min && velocityFps <= max
      })
    }

    if (filters.streamOrder?.length) {
      filtered = filtered.filter(f => 
        filters.streamOrder!.includes(f.stream_order?.toString() || '')
      )
    }

    // Cache result with performance logging
    this.filteredFeaturesCache.set(cacheKey, filtered)
    
    // Increase cache size for better hit rates and performance
    if (this.filteredFeaturesCache.size > 200) { // Increased from 100
      const firstKey = this.filteredFeaturesCache.keys().next().value
      if (firstKey) {
        this.filteredFeaturesCache.delete(firstKey)
      }
    }

    console.timeEnd(`Filtering ${this.getFeatures().length} features`)
    console.log(`Cache stats: ${this.filteredFeaturesCache.size}/200 entries, Result size: ${filtered.length}`)
    return filtered
  }

  /**
   * Binary search for range queries
   */
  private binarySearchLeft(arr: number[], target: number): number {
    let left = 0, right = arr.length
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (arr[mid] < target) left = mid + 1
      else right = mid
    }
    return left
  }

  private binarySearchRight(arr: number[], target: number): number {
    let left = 0, right = arr.length
    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (arr[mid] <= target) left = mid + 1
      else right = mid
    }
    return left - 1
  }

  /**
   * Get hierarchical filter options based on current selections
   */
  getHierarchicalFilterOptions(filters: {
    businessUnit?: string[]
    systemName?: string[]
    pipelineName?: string[]
  } = {}): {
    businessUnit: FilterOption[]
    systemName: FilterOption[]
    pipelineName: FilterOption[]
    routeNumber: FilterOption[]
  } {
    let filteredFeatures = this.getFeatures()

    // Apply business unit filter first
    if (filters.businessUnit?.length) {
      filteredFeatures = filteredFeatures.filter(f => filters.businessUnit!.includes(f.business_unit))
    }

    // Generate system name options based on selected business units
    let systemNameFeatures = filteredFeatures
    if (filters.systemName?.length) {
      systemNameFeatures = filteredFeatures.filter(f => 
        f.system_name && filters.systemName!.includes(f.system_name)
      )
    }

    // Generate pipeline name options based on selected business units and system names
    let pipelineNameFeatures = systemNameFeatures
    if (filters.pipelineName?.length) {
      pipelineNameFeatures = systemNameFeatures.filter(f => 
        f.pipeline_name && filters.pipelineName!.includes(f.pipeline_name)
      )
    }

    return {
      businessUnit: Array.from(new Set(this.getFeatures().map(f => f.business_unit)))
        .sort()
        .map(value => ({ value, label: this.getBusinessUnitLabel(value) })),
      
      systemName: Array.from(new Set(filteredFeatures
        .map(f => f.system_name)
        .filter(name => name !== null && name !== '')))
        .sort()
        .map(value => ({ value: value as string, label: this.getSystemNameLabel(value as string) })),
      
      pipelineName: Array.from(new Set(systemNameFeatures
        .map(f => f.pipeline_name)
        .filter(name => name !== null && name !== '')))
        .sort()
        .map(value => ({ value: value as string, label: value as string })),
      
      routeNumber: Array.from(new Set(pipelineNameFeatures.map(f => f.route_number)))
        .sort()
        .map(value => {
          const strVal = value !== undefined && value !== null ? String(value) : ""
          return { value: strVal, label: strVal }
        })
    }
  }

  /**
   * Get comprehensive filter options with caching and index optimization
   */
  getComprehensiveFilterOptions(filters: FilterCriteria = {}): {
    businessUnit: FilterOption[]
    systemName: FilterOption[]
    pipelineName: FilterOption[]
    pix: FilterOption[]
    riverCrossingId: FilterOption[]
    streamOrder: FilterOption[]
    gnisName: FilterOption[]
    routeNumber: FilterOption[]
    dynamicRanges: { flow: [number, number], velocity: [number, number] }
  } {
    const cacheKey = this.generateCacheKey(filters)
    
    // Check cache first
    if (this.comprehensiveOptionsCache.has(cacheKey)) {
      return this.comprehensiveOptionsCache.get(cacheKey)
    }

    console.time('Calculating comprehensive options')

    // Create different filtered feature sets for proper cascading
    const allFeatures = this.getFeatures()
    
    // Helper function to apply range filters
    const applyRangeFilters = (features: PipelineFeature[]) => {
      let filtered = features
      
      if (filters.flowRange) {
        const [min, max] = filters.flowRange
        filtered = filtered.filter(f => {
          const flowCfs = this.convertQemaToCfs(f.qema)
          return flowCfs >= min && flowCfs <= max
        })
      }

      if (filters.velocityRange) {
        const [min, max] = filters.velocityRange
        filtered = filtered.filter(f => {
          const velocityFps = this.convertVemaToFps(f.vema)
          return velocityFps >= min && velocityFps <= max
        })
      }
      
      return filtered
    }

    // ---------- Proper hierarchical cascading filter logic ----------
    // Hierarchy: Business Unit -> System Name -> Pipeline Name -> Other filters
    
    // Business Unit options: Only filtered by range filters and stream order (top level)
    let businessUnitFeatures = allFeatures
    if (filters.streamOrder?.length) {
      businessUnitFeatures = businessUnitFeatures.filter(f => filters.streamOrder!.includes(String(f.stream_order ?? '')))
    }
    businessUnitFeatures = applyRangeFilters(businessUnitFeatures)

    // System Name options: Filtered by Business Unit selections only
    let systemNameFeatures = allFeatures
    if (filters.businessUnit?.length) {
      systemNameFeatures = systemNameFeatures.filter(f => filters.businessUnit!.includes(f.business_unit))
    }
    if (filters.streamOrder?.length) {
      systemNameFeatures = systemNameFeatures.filter(f => filters.streamOrder!.includes(String(f.stream_order ?? '')))
    }
    systemNameFeatures = applyRangeFilters(systemNameFeatures)

    // Pipeline Name options: Filtered by Business Unit and System Name selections
    let pipelineNameFeatures = allFeatures
    if (filters.businessUnit?.length) {
      pipelineNameFeatures = pipelineNameFeatures.filter(f => filters.businessUnit!.includes(f.business_unit))
    }
    if (filters.systemName?.length) {
      pipelineNameFeatures = pipelineNameFeatures.filter(f => f.system_name && filters.systemName!.includes(f.system_name))
    }
    if (filters.streamOrder?.length) {
      pipelineNameFeatures = pipelineNameFeatures.filter(f => filters.streamOrder!.includes(String(f.stream_order ?? '')))
    }
    pipelineNameFeatures = applyRangeFilters(pipelineNameFeatures)

    // All other options: Filtered by Business Unit, System Name, and Pipeline Name (bottom level)
    let otherOptionsFeatures = allFeatures
    if (filters.businessUnit?.length) {
      otherOptionsFeatures = otherOptionsFeatures.filter(f => filters.businessUnit!.includes(f.business_unit))
    }
    if (filters.systemName?.length) {
      otherOptionsFeatures = otherOptionsFeatures.filter(f => f.system_name && filters.systemName!.includes(f.system_name))
    }
    if (filters.pipelineName?.length) {
      otherOptionsFeatures = otherOptionsFeatures.filter(f => f.pipeline_name && filters.pipelineName!.includes(f.pipeline_name))
    }
    if (filters.streamOrder?.length) {
      otherOptionsFeatures = otherOptionsFeatures.filter(f => filters.streamOrder!.includes(String(f.stream_order ?? '')))
    }
    otherOptionsFeatures = applyRangeFilters(otherOptionsFeatures)

    // Generate options from the properly filtered base set
    const result = {
      businessUnit: Array.from(new Set(businessUnitFeatures.map(f => f.business_unit)))
        .sort()
        .map(value => ({ value, label: this.getBusinessUnitLabel(value) })),
      
      systemName: Array.from(new Set(systemNameFeatures.map(f => f.system_name).filter(Boolean)))
        .sort()
        .map(value => ({ value: value as string, label: this.getSystemNameLabel(value as string) })),
      
      pipelineName: Array.from(new Set(pipelineNameFeatures.map(f => f.pipeline_name).filter(Boolean)))
        .sort()
        .map(value => ({ value: value as string, label: value as string })),
      
      pix: Array.from(new Set(otherOptionsFeatures.map(f => f.pix)))
        .sort()
        .map(value => ({ value, label: value })),
      
      riverCrossingId: Array.from(new Set(otherOptionsFeatures.map(f => f.riverCrossingId).filter(Boolean)))
        .sort()
        .map(value => ({ value: value as string, label: value as string })),
      
      gnisName: Array.from(new Set(otherOptionsFeatures
        .map(f => f.gnis_name)
        .filter(name => name !== null && name !== '')))
        .sort()
        .map(value => ({ value: value as string, label: value as string })),
      
      routeNumber: Array.from(new Set(otherOptionsFeatures.map(f => f.route_number)))
        .sort()
        .map(value => {
          const strVal = value !== undefined && value !== null ? String(value) : ""
          return { value: strVal, label: strVal }
        }),
      
      streamOrder: [
        { value: "1", label: "1 - Headwater Streams" },
        { value: "2", label: "2 - Small Creeks" },
        { value: "3", label: "3 - Small Rivers" },
        { value: "4", label: "4 - Medium Rivers" },
        { value: "5+", label: "5+ - Large Rivers" },
      ],
      
      dynamicRanges: this.calculateDynamicRanges()
    }

    // Cache result
    this.comprehensiveOptionsCache.set(cacheKey, result)
    
    // Increase cache size for better performance
    if (this.comprehensiveOptionsCache.size > 50) { // Increased from 20
      const firstKey = this.comprehensiveOptionsCache.keys().next().value
      if (firstKey) {
        this.comprehensiveOptionsCache.delete(firstKey)
      }
    }

    console.timeEnd('Calculating comprehensive options')
    return result
  }

  /**
   * Process data and generate filter options
   */
  getProcessedData(): ProcessedData {
    if (this.processedData) {
      return this.processedData
    }

    const features = this.getFeatures()
    const dynamicRanges = this.calculateDynamicRanges()
    const hierarchicalOptions = this.getHierarchicalFilterOptions()
    
    // Generate unique options for each filter type
    const pixOptions = Array.from(new Set(features.map(f => f.pix)))
      .sort()
      .map(value => ({ value, label: value }))

    const riverCrossingIds = Array.from(new Set(features
      .map(f => f.riverCrossingId)
      .filter(id => id !== null && id !== undefined)))
      .sort()
      .map(value => ({ value: value as string, label: value as string }))

    const gnisNames = Array.from(new Set(features
      .map(f => f.gnis_name)
      .filter(name => name !== null && name !== '')))
      .sort()
      .map(value => ({ value: value as string, label: value as string }))

    // Generate stream order options (synthetic for now)
    const streamOrders = [
      { value: "1", label: "1 - Headwater Streams" },
      { value: "2", label: "2 - Small Creeks" },
      { value: "3", label: "3 - Small Rivers" },
      { value: "4", label: "4 - Medium Rivers" },
      { value: "5+", label: "5+ - Large Rivers" },
    ]

    this.processedData = {
      features,
      filterOptions: {
        businessUnit: hierarchicalOptions.businessUnit,
        systemName: hierarchicalOptions.systemName,
        pipelineName: hierarchicalOptions.pipelineName,
        routeNumber: hierarchicalOptions.routeNumber,
        pix: pixOptions,
        riverCrossingId: riverCrossingIds,
        streamOrder: streamOrders,
        gnisName: gnisNames,
      },
      dynamicRanges
    }

    return this.processedData!
  }

  /**
   * Get human-readable business unit labels
   */
  private getBusinessUnitLabel(unit: string): string {
    const labels: Record<string, string> = {
      "NGP": "Natural Gas Pipeline (NGP)",
      "LNG": "Liquefied Natural Gas (LNG)",
      "GAS": "Gas Transmission (GAS)",
      "OIL": "Oil Pipeline (OIL)",
      "PWR": "Power Infrastructure (PWR)",
    }
    return labels[unit] || unit
  }

  /**
   * Get human-readable system name labels
   */
  private getSystemNameLabel(name: string): string {
    const labels: Record<string, string> = {
      "MGT": "Midwestern Gas Transmission (MGT)",
      "TGP": "Tennessee Gas Pipeline (TGP)",
      "ANR": "ANR Pipeline (ANR)",
      "GTN": "Gas Transmission Northwest (GTN)",
      "NGPL": "Natural Gas Pipeline Co. (NGPL)",
    }
    return labels[name] || name
  }



  /**
   * Get statistics for the dataset
   */
  getStatistics() {
    const features = this.getFeatures()
    
    // Filter out null values for calculations
    const validHistoryMax = features.filter(f => f.history_max !== null).map(f => f.history_max as number)
    
    return {
      totalFeatures: features.length,
      businessUnits: Array.from(new Set(features.map(f => f.business_unit))).length,
      systemNames: Array.from(new Set(features.filter(f => f.system_name).map(f => f.system_name))).length,
      pipelineNames: Array.from(new Set(features.filter(f => f.pipeline_name).map(f => f.pipeline_name))).length,
      riverCrossings: Array.from(new Set(features.filter(f => f.riverCrossingId).map(f => f.riverCrossingId))).length,
      averageQema: features.reduce((sum, f) => sum + f.qema, 0) / features.length,
      averageVema: features.reduce((sum, f) => sum + f.vema, 0) / features.length,
      averageHistoryMax: validHistoryMax.length > 0 ? validHistoryMax.reduce((sum, val) => sum + val, 0) / validHistoryMax.length : 0,
    }
  }

  /**
   * Clear caches to free memory
   */
  clearCaches(): void {
    this.comprehensiveOptionsCache.clear()
    this.filteredFeaturesCache.clear()
  }

  /**
   * Simulate API fetch delay
   */
  async fetchData(): Promise<ProcessedData> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200)) // Reduced from 500ms
    return this.getProcessedData()
  }
}

// Export singleton instance
export const dataService = new DataService()
export default dataService 