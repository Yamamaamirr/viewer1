import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import type { PipelineFeature, ProcessedData } from "@/types/data"
import { dataService } from "@/services/dataService"

interface DataContextType {
  processedData: ProcessedData | null
  filteredFeatures: PipelineFeature[]
  loading: boolean
  error: string | null
  refreshData: () => Promise<void>
  setFilteredFeatures: (features: PipelineFeature[]) => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: ReactNode
}

export function DataProvider({ children }: DataProviderProps) {
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null)
  const [filteredFeatures, setFilteredFeatures] = useState<PipelineFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await dataService.fetchData()
      
      // Ensure data is valid before setting
      if (data && Array.isArray(data.features)) {
        setProcessedData(data)
        setFilteredFeatures(data.features) // Initially show all features
        console.log('Data loaded successfully:', data.features.length, 'features')
      } else {
        throw new Error('Invalid data structure received')
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
      console.error("Data loading error:", err)
      // Set empty arrays as fallback
      setFilteredFeatures([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  const value: DataContextType = {
    processedData,
    filteredFeatures,
    loading,
    error,
    refreshData,
    setFilteredFeatures,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextType {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}

export default DataContext 