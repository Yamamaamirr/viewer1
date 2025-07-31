// Pipeline Feature Data Types
export interface PipelineFeature {
  type: "Feature"
  geometry: {
    type: "Point"
    coordinates: [number, number] // [longitude, latitude]
  } | null
  pix: string
  route_number: string
  history_max: number | null // Can be null in actual data
  business_unit: string
  qema: number
  vema: number
  gnis_name: string | null
  gnis_id: string | null
  env?: string
  spatial_group?: string
  pipeline_name: string | null
  system_name: string | null
  RCID: string | null
  riverCrossingId: string | null // Computed from RCID, can be null
  stream_order?: string | number
}

export interface PipelineDataCollection {
  type: "FeatureCollection"
  features: PipelineFeature[]
  total_records?: number
}

// Filter option types
export interface FilterOption {
  value: string
  label: string
}

// Derived data for filters and tables
export interface ProcessedData {
  features: PipelineFeature[]
  filterOptions: {
    businessUnit: FilterOption[]
    systemName: FilterOption[]
    pipelineName: FilterOption[]
    routeNumber: FilterOption[]
    pix: FilterOption[]
    riverCrossingId: FilterOption[]
    streamOrder: FilterOption[]
    gnisName: FilterOption[]
  }
  dynamicRanges: {
    flow: [number, number]
    velocity: [number, number]
  }
} 