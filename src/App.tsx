import { useState, useEffect } from "react"
import { Filter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FilterToolbar } from "@/components/filter-toolbar"
import { MapView } from "@/components/map-view"
import { useFilters } from "@/hooks/use-filters"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { DataTable } from "@/components/data-table"

function App() {
  const { filters, setFilter, resetFilters, isFiltered, getComprehensiveOptions } = useFilters()
  const isMobile = useIsMobile()
  const [mobileFiltersVisible, setMobileFiltersVisible] = useState(false)
  const [tableVisible, setTableVisible] = useState(false)
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isTableMaximized, setIsTableMaximized] = useState(false)
  const [isExtentActive, setIsExtentActive] = useState(false)
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false)

  // Note: Users can clear selections manually using the "Clear selection" button in the table

  // Keyboard shortcut to toggle filter collapse (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'b' && !isMobile) {
        event.preventDefault()
        setIsFilterCollapsed(!isFilterCollapsed)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFilterCollapsed, isMobile])

  return (
    <div className="relative h-screen w-screen bg-white">
      {/* Mobile filter toggle button */}
      {isMobile && (
        <div className="absolute top-16 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-md">
          <Button variant="ghost" size="icon" onClick={() => setMobileFiltersVisible(!mobileFiltersVisible)}>
            {mobileFiltersVisible ? <X className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
            <span className="sr-only">Toggle Filters</span>
          </Button>
        </div>
      )}

      {/* Filter Toolbar Overlay */}
      <div
        className={cn(
          "absolute top-0 left-0 h-full z-40 transition-all duration-300 ease-in-out",
          "shadow-xl",
          isMobile
            ? mobileFiltersVisible ? "block" : "hidden"
            : "block"
        )}
      >
        <FilterToolbar 
          filters={filters} 
          setFilter={setFilter} 
          resetFilters={resetFilters} 
          isFiltered={isFiltered}
          getComprehensiveOptions={getComprehensiveOptions}
          isMapLoading={isMapLoading}
          isExtentActive={isExtentActive}
          setIsExtentActive={setIsExtentActive}
          isCollapsed={!isMobile && isFilterCollapsed}
          onToggleCollapse={() => setIsFilterCollapsed(!isFilterCollapsed)}
        />
      </div>

      {/* Main content - always full width */}
      <main className="w-full h-full relative">
        <MapView 
          isMapLoading={isMapLoading} 
          setIsMapLoading={setIsMapLoading}
          selectedRows={selectedRows}
          tableVisible={tableVisible}
          tableMaximized={isTableMaximized}
          isExtentActive={isExtentActive}
          setIsExtentActive={setIsExtentActive}
          isFilterCollapsed={!isMobile && isFilterCollapsed}
        />
        
        {/* Data Table Overlay - positioned on top of map */}
        <DataTable 
          isVisible={tableVisible} 
          onToggle={() => setTableVisible(!tableVisible)}
          selectedRows={selectedRows}
          setSelectedRows={setSelectedRows}
          isMaximized={isTableMaximized}
          setIsMaximized={setIsTableMaximized}
          isFilterCollapsed={!isMobile && isFilterCollapsed}
        />
      </main>
    </div>
  )
}

export default App 