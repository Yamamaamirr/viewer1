"use client"

import { useState, useEffect, useCallback, useMemo, memo } from "react"
import type { UIEvent, MouseEvent } from "react"
import { Check, ChevronsUpDown, X, Plus, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type OptionType = {
  label: string
  value: string
}

interface MultiSelectProps {
  options: OptionType[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

const ITEMS_PER_BATCH = 20

const MultiSelectComponent = ({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_BATCH)
  const [isLoading, setIsLoading] = useState(false)

  // Robust case-insensitive filtering that safely handles non-string labels/values
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    
    const query = searchQuery.toLowerCase()

    return options.filter((option) => {
      const labelStr = option.label !== undefined && option.label !== null ? String(option.label).toLowerCase() : ""
      const valueStr = option.value !== undefined && option.value !== null ? String(option.value).toLowerCase() : ""

      return labelStr.includes(query) || valueStr.includes(query)
    })
  }, [options, searchQuery])

  // Optimize virtualization by limiting displayed options
  const displayedOptions = useMemo(() => {
    return filteredOptions.slice(0, displayedCount)
  }, [filteredOptions, displayedCount])

  // Check if there are more items to load
  const hasMore = displayedCount < filteredOptions.length

  // Load more items
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    
    setIsLoading(true)
    
    // Simulate slight delay for better UX
    await new Promise(resolve => setTimeout(resolve, 100))
    
    setDisplayedCount(prev => Math.min(prev + ITEMS_PER_BATCH, filteredOptions.length))
    setIsLoading(false)
  }, [isLoading, hasMore, filteredOptions.length])

  // Reset displayed count when search query changes
  useEffect(() => {
    setDisplayedCount(ITEMS_PER_BATCH)
  }, [searchQuery])

  // Handle scroll to load more items
  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    
    // Load more when scrolled to bottom (with small threshold)
    if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore && !isLoading) {
      loadMore()
    }
  }, [loadMore, hasMore, isLoading])

  const handleSelect = useCallback((value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }, [selected, onChange])

  const handleRemove = useCallback((value: string, e: MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter((item) => item !== value))
  }, [selected, onChange])

  // Reset state when popover closes - fix flicker by delaying reset
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Delay the reset to prevent flicker during close animation
      setTimeout(() => {
        setSearchQuery("")
        setDisplayedCount(ITEMS_PER_BATCH)
      }, 150) // Wait for popover close animation
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-[32px] h-auto py-1 px-2 bg-white hover:bg-gray-50/80 font-normal border-gray-200 text-gray-700 hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-[#8187FF]/20 focus-visible:border-[#8187FF] transition-all duration-200 text-xs",
            open && "border-[#8187FF] ring-2 ring-[#8187FF]/20",
            className,
          )}
        >
          <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 items-center">
                {options
                  .filter((option) => selected.includes(option.value))
                  .slice(0, 3) // Show max 3 badges to prevent overflow
                  .map((option, index) => (
                    <Badge
                      variant="secondary"
                      key={option.value}
                      className={cn(
                        "group px-2.5 py-1 bg-gradient-to-r from-[#8187FF]/10 to-[#8187FF]/15 text-[#8187FF] border border-[#8187FF]/25 hover:from-[#8187FF]/15 hover:to-[#8187FF]/25 hover:border-[#8187FF]/40 font-medium text-xs cursor-pointer transition-all duration-200 ease-out animate-in fade-in-0 zoom-in-95 rounded-sm",
                        `animation-delay-[${index * 50}ms]`
                      )}
                      onClick={(e) => handleRemove(option.value, e)}
                    >
                      <span className="truncate max-w-[120px] text-xs">{option.label}</span>
                      <X className="ml-1.5 h-3 w-3 text-[#8187FF]/70 group-hover:text-[#8187FF] transition-colors duration-200" />
                    </Badge>
                  ))}
                {selected.length > 3 && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 border border-gray-200 text-xs px-2 py-1">
                    +{selected.length - 3} more
                  </Badge>
                )}
                {selected.length < options.length && (
                  <div className="flex items-center">
                    <Plus className="h-3.5 w-3.5 text-gray-400 mr-1" />
                    <span className="text-gray-400 text-xs">Add more...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center text-gray-500 text-xs">
                <Plus className="h-4 w-4 text-gray-400 mr-2" />
                {placeholder}
              </div>
            )}
          </div>
          <ChevronsUpDown className={cn(
            "ml-2 h-4 w-4 shrink-0 text-gray-400 transition-all duration-200",
            open && "rotate-180 text-gray-600"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0 shadow-lg border-gray-200 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2" 
        sideOffset={4}
      >
        <Command className="rounded-lg">
          <CommandInput 
            placeholder="Search options..." 
            className="border-0 focus:ring-0 text-sm"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-64" onScroll={handleScroll}>
            <CommandEmpty className="py-6 text-center text-sm text-gray-500">
              {filteredOptions.length === 0 ? "No options found." : "No results for your search."}
            </CommandEmpty>
            <CommandGroup className="p-1">
              {displayedOptions.map((option) => {
                const isSelected = selected.includes(option.value)
                return (
                  <CommandItem 
                    key={option.value} 
                    onSelect={() => handleSelect(option.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer rounded-md transition-all duration-200 hover:bg-gray-50",
                      isSelected && "bg-[#8187FF]/5 text-[#8187FF] hover:bg-[#8187FF]/10"
                    )}
                  >
                    <div className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border transition-all duration-200",
                      isSelected 
                        ? "bg-[#8187FF] border-[#8187FF]" 
                        : "border-gray-300 hover:border-gray-400"
                    )}>
                      {isSelected && (
                        <Check className="h-3 w-3 text-white animate-in zoom-in-75" />
                      )}
                    </div>
                    <span className="flex-1 truncate">{option.label}</span>
                    {isSelected && (
                      <Badge variant="secondary" className="ml-auto bg-[#8187FF]/10 text-[#8187FF] border border-[#8187FF]/20 text-xs px-1.5 py-0.5">
                        Selected
                      </Badge>
                    )}
                  </CommandItem>
                )
              })}
              
              {/* Load more indicator */}
              {hasMore && (
                <div className="flex items-center justify-center py-2 px-3">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading more...
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMore}
                      className="text-xs text-gray-500 hover:text-gray-700 h-6 px-2"
                    >
                      Load {Math.min(ITEMS_PER_BATCH, filteredOptions.length - displayedCount)} more...
                    </Button>
                  )}
                </div>
              )}
              
              {/* Info about filtered results */}
              {searchQuery && (
                <div className="px-3 py-2 text-xs text-gray-500 border-t">
                  Showing {displayedOptions.length} of {filteredOptions.length} matches
                  {filteredOptions.length !== options.length && (
                    <span> (filtered from {options.length} total)</span>
                  )}
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export const MultiSelect = memo(MultiSelectComponent)
