import { cn } from "@/lib/utils"
import { useState, useRef, useCallback, useEffect, memo } from "react"
import type { ChangeEvent } from "react"
import { Search, X, MapPin, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchResult {
  id: string
  place_name: string
  center: [number, number]
  place_type: string[]
}

interface MapSearchProps {
  onLocationSelect: (location: { center: [number, number]; name: string }) => void
}

// Mapbox access token imported from shared constants
import { MAPBOX_ACCESS_TOKEN } from "@/lib/constants"

const MapSearchComponent = ({ onLocationSelect }: MapSearchProps) => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery,
        )}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=6&types=place,locality,neighborhood,address,poi`,
      )
      const data = await response.json()
      setResults(data.features || [])
    } catch (error) {
      console.error("Search error:", error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Optimized debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      searchPlaces(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, searchPlaces])

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
      setIsOpen(false)
      setIsFocused(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleClickOutside])

  const handleResultClick = useCallback((result: SearchResult) => {
    onLocationSelect({
      center: result.center,
      name: result.place_name,
    })
    setQuery(result.place_name.split(",")[0])
    setIsOpen(false)
    setIsFocused(false)
    setResults([])
  }, [onLocationSelect])

  const clearSearch = useCallback(() => {
    setQuery("")
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }, [])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setIsOpen(true)
  }, [])

  const handleBlur = useCallback(() => {
    // Delay to allow click events on results
    setTimeout(() => {
      setIsFocused(false)
    }, 150)
  }, [])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setIsOpen(true)
  }, [])

  return (
    <div ref={searchRef} className="relative w-56">
      {/* Search Input Container */}
      <div
        className={cn(
          "relative bg-white border border-gray-200 rounded-md transition-all duration-200 ease-out overflow-hidden",
          isFocused ? "shadow-lg ring-2 ring-[#8187FF]/10" : "shadow-sm hover:shadow-md hover:border-gray-300",
        )}
      >
        <div className="flex items-center">
          <div className="flex items-center justify-center w-8 h-8 text-gray-400 pl-2">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8187FF]" /> : <Search className="h-3.5 w-3.5" />}
          </div>

          <input
            ref={inputRef}
            type="text"
            placeholder="Search places..."
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="flex-1 bg-white bg-opacity-90 border-0 outline-none focus:outline-none focus:ring-0 text-xs placeholder:text-gray-500 h-8 px-1.5 text-gray-900"
          />

          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-4 w-4 p-0 mr-1.5 hover:bg-gray-100 rounded-none"
            >
              <X className="h-3 w-3 text-gray-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && (query || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          {isLoading && !results.length ? (
            <div className="p-3 text-center">
              <div className="flex items-center justify-center space-x-2 text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Searching...</span>
              </div>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {results.map((result, index) => {
                const [primaryName, ...secondaryParts] = result.place_name.split(",")
                const secondaryName = secondaryParts.join(",").trim()

                return (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      "w-full text-left p-2.5 hover:bg-[#8187FF]/5 transition-colors duration-150 group flex items-center space-x-2.5",
                      index !== results.length - 1 && "border-b border-gray-100",
                    )}
                  >
                    <div className="flex-shrink-0 w-7 h-7 bg-gray-100 rounded-md flex items-center justify-center group-hover:bg-[#8187FF]/10 transition-colors">
                      <MapPin className="h-3.5 w-3.5 text-gray-600 group-hover:text-[#8187FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate group-hover:text-[#8187FF]">
                        {primaryName}
                      </p>
                      {secondaryName && (
                        <p className="text-xs text-gray-500 truncate mt-0.5 group-hover:text-gray-600">
                          {secondaryName}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : query ? (
            <div className="p-3 text-center text-gray-500">
              <p className="text-xs">No places found</p>
              <p className="text-xs mt-1 text-gray-400">Try a different search term</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export const MapSearch = memo(MapSearchComponent)
