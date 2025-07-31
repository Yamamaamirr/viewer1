import { useState, useEffect, useCallback, useMemo, memo } from "react"
import type { Dispatch, SetStateAction, CSSProperties } from "react"
import { ChevronUp, ChevronDown, Maximize2, Minimize2, LineChart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useData } from "@/contexts/DataContext"
import { TableSkeleton } from "@/components/ui/skeleton"

// Unit conversion constants (same as in dataService)
const M3_TO_CFS = 35.314666212661 // Convert m³/s to cubic feet per second
const MS_TO_FPS = 3.28084 // Convert m/s to feet per second

interface DataTableProps {
  isVisible: boolean
  onToggle: () => void
  selectedRows: Set<string>
  setSelectedRows: Dispatch<SetStateAction<Set<string>>>
  isMaximized: boolean
  setIsMaximized: Dispatch<SetStateAction<boolean>>
  isFilterCollapsed?: boolean
}

interface VirtualizedRowProps {
  index: number
  style: CSSProperties
  data: {
    items: any[]
    selectedRows: Set<string>
    toggleRowSelection: (pix: string) => void
    convertAndFormatFlow: (qema: number) => string
    convertAndFormatVelocity: (vema: number) => string
    getBusinessUnitBadge: (unit: string) => string
  }
}

// Memoized row component for virtual scrolling
const VirtualizedRow = memo(({ index, style, data }: VirtualizedRowProps) => {
  const { items, selectedRows, toggleRowSelection, convertAndFormatFlow, convertAndFormatVelocity, getBusinessUnitBadge } = data
  const row = items[index]
  
  if (!row) return null

  const isSelected = selectedRows.has(row.pix)

  return (
    <div style={style}>
      <div
        onClick={() => toggleRowSelection(row.pix)}
        className={cn(
          "flex border-b border-gray-100/60 transition-all duration-200 cursor-pointer group relative min-h-[40px] items-center",
          index % 2 === 0 ? "bg-white" : "bg-gray-25/30",
          isSelected
            ? "bg-[#FD8408]/15 hover:bg-[#FD8408]/20 border-l-4 border-l-[#FD8408]"
            : "hover:bg-gray-50/60 border-l-4 border-l-transparent hover:border-l-gray-200",
        )}
      >
        {/* PIX */}
        <div className="text-xs text-gray-900 font-mono font-medium py-2 px-2.5 w-[120px] truncate" title={row.pix}>
          {row.pix}
        </div>
        {/* River Crossing ID */}
        <div className="text-xs text-gray-700 py-2 px-2.5 font-medium w-[140px]">
          {row.riverCrossingId || <span className="text-gray-400 italic">N/A</span>}
        </div>
        {/* Business Unit */}
        <div className="py-2 px-2.5 w-[110px]">
          <span className={getBusinessUnitBadge(row.business_unit)}>{row.business_unit}</span>
        </div>
        {/* System Name */}
        <div className="text-xs text-gray-700 py-2 px-2.5 font-medium w-[120px]">
          {row.system_name || <span className="text-gray-400 italic">N/A</span>}
        </div>
        {/* Pipeline Name */}
        <div className="text-xs text-gray-700 py-2 px-2.5 font-medium w-[180px] truncate" title={row.pipeline_name || "N/A"}>
          {row.pipeline_name || <span className="text-gray-400 italic">N/A</span>}
        </div>
        {/* Route Number */}
        <div className="text-xs text-gray-700 py-2 px-2.5 font-medium w-[100px]">{row.route_number}</div>
        {/* Avg Flow */}
        <div className="text-xs text-gray-700 py-2 px-2.5 font-mono w-[90px]">{convertAndFormatFlow(row.qema)}</div>
        {/* Avg Velocity */}
        <div className="text-xs text-gray-700 py-2 px-2.5 font-mono w-[90px]">{convertAndFormatVelocity(row.vema)}</div>
        {/* Max Historic Flow */}
        <div className="text-xs text-gray-600 py-2 px-2.5 text-left w-[90px]">
          {row.history_max !== null ? row.history_max : <span className="text-gray-400 italic">N/A</span>}
        </div>
        {/* Action Button */}
        <div className="py-1.5 pl-2 pr-0 w-[38px] flex justify-start items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              console.log('Graph button clicked for PIX:', row.pix)
            }}
            className="h-6 w-6 p-0 bg-[#8187FF] hover:bg-[#6B73E6] text-white hover:text-white rounded transition-all duration-200"
            title={`View graph for ${row.pix}`}
          >
            <LineChart className="h-3 w-3 p-0.25" />
          </Button>
        </div>
      </div>
    </div>
  )
})

VirtualizedRow.displayName = "VirtualizedRow"

const DataTableComponent = ({ isVisible, onToggle, selectedRows, setSelectedRows, isMaximized, setIsMaximized, isFilterCollapsed = false }: DataTableProps) => {
  const { filteredFeatures, loading } = useData()
  const [currentPage, setCurrentPage] = useState(1)
  
  // Use stable items per page values
  const minimizedItemsPerPage = 8
  const maximizedItemsPerPage = 50
  const itemsPerPage = isMaximized ? maximizedItemsPerPage : minimizedItemsPerPage

  // Use filtered features from context
  const data = filteredFeatures

  // Memoize expensive calculations
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(data.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentData = data.slice(startIndex, endIndex)
    
    return {
      totalPages,
      startIndex,
      endIndex,
      currentData
    }
  }, [data.length, currentPage, itemsPerPage])

  const { totalPages, startIndex, endIndex, currentData } = paginationData

  // Helper functions for unit conversion and formatting
  const convertAndFormatFlow = useCallback((qema: number): string => {
    const flowCfs = qema * M3_TO_CFS
    return flowCfs.toFixed(2)
  }, [])

  const convertAndFormatVelocity = useCallback((vema: number): string => {
    const velocityFps = vema * MS_TO_FPS
    return velocityFps.toFixed(2)
  }, [])

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [data.length])

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // Handle maximize/minimize with pagination position preservation
  const handleToggleMaximize = useCallback(() => {
    // Calculate current first item index
    const currentFirstItemIndex = (currentPage - 1) * itemsPerPage
    
    // Toggle maximized state
    const newIsMaximized = !isMaximized
    const newItemsPerPage = newIsMaximized ? maximizedItemsPerPage : minimizedItemsPerPage
    
    // Calculate new page to maintain position
    const newPage = Math.floor(currentFirstItemIndex / newItemsPerPage) + 1
    const maxNewPages = Math.ceil(data.length / newItemsPerPage)
    
    setIsMaximized(newIsMaximized)
    setCurrentPage(Math.max(1, Math.min(newPage, maxNewPages)))
  }, [currentPage, itemsPerPage, isMaximized, data.length, maximizedItemsPerPage, minimizedItemsPerPage])

  const toggleRowSelection = useCallback((pix: string) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(pix)) {
        newSet.delete(pix)
      } else {
        newSet.add(pix)
      }
      return newSet
    })
  }, [setSelectedRows])

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set())
  }, [setSelectedRows])

  const getBusinessUnitBadge = (_unit: string) => {
    const baseClasses = "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium transition-colors"
    return `${baseClasses} bg-gray-500 text-white border border-gray-600`
  }

  if (loading) {
    return (
      <div className="absolute bottom-6 left-1/2 z-20 transform -translate-x-1/2">
        <div className="bg-white border border-gray-200/60 rounded-lg px-4 py-2 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-gray-300 rounded animate-pulse"></div>
            <span className="text-sm text-gray-500">Loading data...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!isVisible) {
    // Floating minimized state - positioned to avoid filter nav
    return (
      <div className={cn(
        "absolute bottom-6 transform -translate-x-1/2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-auto z-30",
        // Position based on filter nav state
        isFilterCollapsed ? "left-[calc(50%+24px)]" : "left-[calc(50%+175px)]"
      )}>
        <div
          onClick={onToggle}
          className="group cursor-pointer bg-white border border-gray-200/60 rounded-lg px-4 py-2 hover:bg-gray-50 transition-all duration-200 ease-out shadow-sm active:scale-95"
        >
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors duration-150">
              Data Overview
            </span>
            <div className="flex items-center space-x-2">
              <div className="px-2.5 py-1 bg-gray-100/80 rounded-md">
                <span className="text-xs text-gray-600 font-medium">{data.length}</span>
              </div>
              {selectedRows.size > 0 && (
                <div className="px-2.5 py-1 bg-[#FD8408]/10 border border-[#FD8408]/20 rounded-md">
                  <span className="text-xs text-[#FD8408] font-medium">{selectedRows.size} selected</span>
                </div>
              )}
              <ChevronUp className="h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-all duration-150 group-hover:-translate-y-0.5" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Full expanded table state - overlay positioned to right of filter nav
  return (
    <div
      className={cn(
        "absolute bottom-0 right-0 transform transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-30",
        // Position based on filter nav state
        isFilterCollapsed ? "left-12" : "left-[350px]",
        isVisible 
          ? "translate-y-0 opacity-100 pointer-events-auto" 
          : "translate-y-4 opacity-0 pointer-events-none"
      )}
      style={{
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        transformOrigin: 'bottom center'
      }}
    >
      <div 
        className="bg-white/95 backdrop-blur-sm border-t border-gray-200/80 shadow-lg overflow-x-auto"
        style={{
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {/* Toggle Header */}
        <div className="flex items-center justify-between px-2.5 py-2 bg-gray-100 border-b border-gray-200/60">
          <div className="flex items-center space-x-3">
            <h3 className="text-xs font-normal text-gray-800 tracking-tight uppercase">Pipeline Data Overview</h3>
            <div className="px-2 py-1 bg-gray-200/60 rounded-md">
              <span className="text-xs text-gray-600 font-medium">{data.length} records</span>
            </div>
            {selectedRows.size > 0 && (
              <>
                <div className="px-2 py-1 bg-[#FD8408]/10 border border-[#FD8408]/20 rounded-md">
                  <span className="text-xs text-[#FD8408] font-medium">{selectedRows.size} selected</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-6 px-2 text-xs text-[#FD8408] hover:bg-[#FD8408]/10 hover:text-[#FD8408]"
                >
                  Clear selection
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleMaximize}
              className="h-7 w-7 p-0 hover:bg-gray-200/60 rounded-lg transition-all duration-150 hover:scale-105"
              title={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5 text-gray-600" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5 text-gray-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-7 w-7 p-0 hover:bg-gray-200/60 rounded-lg transition-all duration-150 hover:scale-105"
            >
              <ChevronDown className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          isMaximized ? "h-[75vh]" : "h-72"
        )}>
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {loading ? (
              <div className="p-4">
                <TableSkeleton rows={itemsPerPage} />
              </div>
            ) : (
              <table className="w-full table-fixed">
                <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                  <tr className="border-b border-gray-200/60">
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[100px] text-left">PIX</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[110px] text-left">River Crossing ID</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[90px] text-left">Business Unit</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[100px] text-left">System Name</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[130px] text-left">Pipeline Name</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[120px] text-left">Waterway Name</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[80px] text-left">Route #</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[80px] text-left">Avg Flow (cfs)</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[80px] text-left">Avg Velocity (fps)</th>
                    <th className="text-xs font-semibold text-gray-700 h-8 px-2 pl-2 bg-gray-50/80 w-[80px] text-left">Max Flow</th>
                    <th className="h-8 px-2 pl-2 bg-gray-50/80 w-[50px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((row, index) => {
                    const isSelected = selectedRows.has(row.pix)
                    return (
                      <tr
                        key={row.pix}
                        onClick={() => toggleRowSelection(row.pix)}
                        className={cn(
                          "border-b border-gray-100/60 transition-all duration-200 cursor-pointer group relative",
                          index % 2 === 0 ? "bg-white" : "bg-gray-25/30",
                          isSelected
                            ? "bg-[#FD8408]/15 hover:bg-[#FD8408]/20 border-l-4 border-l-[#FD8408]"
                            : "hover:bg-gray-50/60 border-l-4 border-l-transparent hover:border-l-gray-200",
                        )}
                      >
                        <td className="text-xs text-gray-900 font-mono font-medium py-2 px-2 w-[100px]">
                          <div className="truncate" title={row.pix}>
                            {row.pix}
                          </div>
                        </td>
                        <td className="text-xs text-gray-700 py-2 px-2 font-medium w-[110px]">
                          {row.riverCrossingId || <span className="text-gray-400 italic">N/A</span>}
                        </td>
                        <td className="py-2 px-2 w-[90px]">
                          <span className={getBusinessUnitBadge(row.business_unit)}>{row.business_unit}</span>
                        </td>
                        <td className="text-xs text-gray-700 py-2 px-2 font-medium w-[100px]">
                          {row.system_name || <span className="text-gray-400 italic">N/A</span>}
                        </td>
                        <td className="text-xs text-gray-700 py-2 px-2 font-medium w-[130px]">
                          <div className="truncate" title={row.pipeline_name || "N/A"}>
                            {row.pipeline_name || <span className="text-gray-400 italic">N/A</span>}
                          </div>
                        </td>
                        <td className="text-xs text-gray-700 py-2 px-2 font-medium w-[120px]">
                          <div className="truncate" title={row.gnis_name || "N/A"}>
                            {row.gnis_name || <span className="text-gray-400 italic">N/A</span>}
                          </div>
                        </td>
                        <td className="text-xs text-gray-700 py-2 px-2 font-medium w-[80px]">{row.route_number}</td>
                        <td className="text-xs text-gray-700 py-2 px-2 font-mono w-[80px]">{convertAndFormatFlow(row.qema)}</td>
                        <td className="text-xs text-gray-700 py-2 px-2 font-mono w-[80px]">{convertAndFormatVelocity(row.vema)}</td>
                        <td className="text-xs text-gray-600 py-2 px-2 text-left w-[80px]">
                          {row.history_max !== null ? row.history_max : <span className="text-gray-400 italic">N/A</span>}
                        </td>
                        <td className="py-1.5 pl-2 pr-0 w-[50px]">
                          <div className="flex justify-start items-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                // Handle graph button click
                                console.log('Graph button clicked for PIX:', row.pix)
                              }}
                              className="h-6 w-6 p-0 bg-[#8187FF] hover:bg-[#6B73E6] text-white hover:text-white rounded transition-all duration-200"
                              title={`View graph for ${row.pix}`}
                            >
                              <LineChart className="h-3 w-3 p-0.25" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#8187FF] border-t border-[#6B73E6]/20 shrink-0">
            <div className="flex items-center space-x-3">
              <span className="text-xs text-gray-200 font-medium">
                Showing {startIndex + 1}–{Math.min(endIndex, data.length)} of {data.length} results
              </span>
              {selectedRows.size > 0 && (
                <span className="text-sm text-white/80 font-medium">• {selectedRows.size} selected</span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-7 px-2.5 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-all duration-150 border-white/20 text-white hover:border-white/30 disabled:hover:bg-white/10"
              >
                <span className="mr-1">←</span>
                Previous
              </Button>

              <div className="flex items-center space-x-1.5 mx-4">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(pageNum)}
                      className={cn(
                        "h-7 w-7 p-0 text-xs font-medium transition-all duration-200 border",
                        currentPage === pageNum
                          ? "bg-white text-[#8187FF] hover:bg-gray-100 border-white shadow-md hover:shadow-lg"
                          : "bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/30 hover:shadow-sm",
                      )}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-7 px-2.5 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-all duration-150 border-white/20 text-white hover:border-white/30 disabled:hover:bg-white/10"
              >
                Next
                <span className="ml-1">→</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const DataTable = memo(DataTableComponent)
