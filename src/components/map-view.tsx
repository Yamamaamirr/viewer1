import { useRef, useState, useEffect, FC, useCallback, useMemo, memo } from "react"
import type { Dispatch, SetStateAction } from "react"
import mapboxgl from "mapbox-gl"
import { MAPBOX_ACCESS_TOKEN } from "@/lib/constants"
import { MapSearch } from "@/components/map-search"
import { useData } from "@/contexts/DataContext"
import type { PipelineFeature } from "@/types/data"
import { cn } from "@/lib/utils"
  
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN


interface MapViewProps {
  isMapLoading: boolean
  setIsMapLoading: Dispatch<SetStateAction<boolean>>
  selectedRows: Set<string>
  tableVisible: boolean
  tableMaximized: boolean
  isFilterCollapsed?: boolean
}

const MapViewComponent: FC<MapViewProps> = ({ isMapLoading, setIsMapLoading, selectedRows, tableVisible, tableMaximized, isFilterCollapsed = false }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [isAutoFitEnabled, setIsAutoFitEnabled] = useState(true)
  const [isMapFullyReady, setIsMapFullyReady] = useState(false) // Track when map is fully initialized
  const autoFitControlRef = useRef<any>(null)
  const boundsAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastFeaturesCountRef = useRef<number>(0)
  const lastTableStateRef = useRef<{ visible: boolean; maximized: boolean }>({ visible: false, maximized: false })
  
  // Connect to data context
  const { filteredFeatures, loading } = useData()

  const handleLocationSelect = useCallback((location: { center: [number, number]; name: string }) => {
    if (map.current) {
      map.current.flyTo({
        center: location.center,
        zoom: 12,
        pitch: 0, // Maintain 2D view
        bearing: 0, // Keep north orientation
        duration: 2000,
        essential: true,
      })
    }
  }, [])

  // Convert pipeline features to GeoJSON - moved outside of component for stability
  const createGeoJSONFromFeatures = useMemo(() => {
    return (features: PipelineFeature[]) => {
      return {
        type: "FeatureCollection" as const,
        features: features
          .filter(feature => feature.geometry && feature.geometry.coordinates)
          .map(feature => ({
            type: "Feature" as const,
            geometry: feature.geometry!,
            properties: {
              pix: feature.pix,
              route_number: feature.route_number,
              history_max: feature.history_max,
              business_unit: feature.business_unit,
              qema: feature.qema,
              vema: feature.vema,
              gnis_name: feature.gnis_name,
              gnis_id: feature.gnis_id,
              pipeline_name: feature.pipeline_name || '',
              system_name: feature.system_name || '',
              riverCrossingId: feature.riverCrossingId || '',
              stream_order: feature.stream_order || ''
            }
          }))
      }
    }
  }, [])

  // Calculate bounds for a set of features
  const calculateBounds = useCallback((features: PipelineFeature[]): mapboxgl.LngLatBoundsLike | null => {
    if (!features.length) return null
    
    const validFeatures = features.filter(f => 
      f.geometry && 
      f.geometry.coordinates && 
      Array.isArray(f.geometry.coordinates) &&
      f.geometry.coordinates.length === 2 &&
      typeof f.geometry.coordinates[0] === 'number' &&
      typeof f.geometry.coordinates[1] === 'number'
    )
    
    if (!validFeatures.length) return null
    
    let minLng = Infinity
    let maxLng = -Infinity
    let minLat = Infinity
    let maxLat = -Infinity
    
    validFeatures.forEach(feature => {
      const [lng, lat] = feature.geometry!.coordinates
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    })
    
    // Add a small buffer if bounds are too tight
    const lngBuffer = Math.max(0.01, (maxLng - minLng) * 0.1)
    const latBuffer = Math.max(0.01, (maxLat - minLat) * 0.1)
    
    return [
      [minLng - lngBuffer, minLat - latBuffer], // Southwest
      [maxLng + lngBuffer, maxLat + latBuffer]  // Northeast
    ]
  }, [])

  // Separate effect for data updates only (no UI state)
  useEffect(() => {
    if (!map.current || loading || !isMapFullyReady) return

    let featuresToShow = Array.isArray(filteredFeatures) ? filteredFeatures : []
    
    if (selectedRows.size > 0) {
      featuresToShow = filteredFeatures.filter(feature => selectedRows.has(feature.pix))
      console.log('Showing selected points only:', featuresToShow.length)
    }
    
    const geojsonData = createGeoJSONFromFeatures(featuresToShow)
    
    // Update map source - no retries needed, map is guaranteed to be ready
    try {
      const source = map.current.getSource('points') as mapboxgl.GeoJSONSource
      source.setData(geojsonData)
      console.log('Map source updated with', geojsonData.features.length, 'features')
    } catch (error) {
      console.error('Error updating map source:', error)
    }
  }, [filteredFeatures, loading, selectedRows, isMapFullyReady, createGeoJSONFromFeatures])

  // Separate effect for bounds animation (debounced)
  useEffect(() => {
    if (!map.current || loading || !isMapFullyReady) return

    let featuresToShow = Array.isArray(filteredFeatures) ? filteredFeatures : []
    if (selectedRows.size > 0) {
      featuresToShow = filteredFeatures.filter(feature => selectedRows.has(feature.pix))
    }

    // Debounced bounds animation to prevent rapid map movements
    if (boundsAnimationTimeoutRef.current) {
      clearTimeout(boundsAnimationTimeoutRef.current)
    }
    
    boundsAnimationTimeoutRef.current = setTimeout(() => {
      if (!map.current) return
      
      // Only animate if the feature count has changed significantly or this is the first load
      const currentCount = featuresToShow.length
      const lastCount = lastFeaturesCountRef.current
      const isSignificantChange = Math.abs(currentCount - lastCount) > Math.max(1, lastCount * 0.1)
      const isFirstLoad = lastCount === 0 && currentCount > 0
      
      // For selected rows, always animate to show them
      const isRowSelection = selectedRows.size > 0
      
      const currentTableState = { visible: tableVisible, maximized: tableMaximized }
      const lastTableState = lastTableStateRef.current
      const isTableStateChange = currentTableState.visible !== lastTableState.visible || 
                                currentTableState.maximized !== lastTableState.maximized
      
      if ((isSignificantChange || isFirstLoad || isRowSelection || isTableStateChange) && isAutoFitEnabled) {
          // If the only change is table visibility and the table just OPENED in MINIMIZED state, adjust padding.
          if (isTableStateChange && tableVisible && !tableMaximized && !isSignificantChange && !isFirstLoad && !isRowSelection) {
            const basePadding = 60
            const filterWidth = isFilterCollapsed ? 48 : 350
            const newPadding = {
              top: basePadding,
              bottom: tableVisible && !tableMaximized ? 350 : basePadding,
              left: filterWidth + 30,
              right: basePadding,
            }
            const currentZoom = map.current.getZoom()
            const currentCenter = map.current.getCenter()
            map.current.easeTo({
              center: currentCenter,
              zoom: currentZoom,
              padding: newPadding,
              duration: 800,
              essential: true,
            })
            console.log('Adjusted map padding for minimized table without altering bounds')
            lastTableStateRef.current = currentTableState
            return
          }
          // If the only change is table visibility and the table just CLOSED, remove extra padding without refitting
          if (isTableStateChange && !tableVisible && !tableMaximized && !isSignificantChange && !isFirstLoad && !isRowSelection) {
            const basePadding = 60
            const filterWidth = isFilterCollapsed ? 48 : 350
            const newPadding = { 
              top: basePadding, 
              bottom: basePadding, 
              left: filterWidth + 30, 
              right: basePadding 
            }
            map.current.easeTo({
              padding: newPadding,
              duration: 800,
              essential: true,
            })
            console.log('Removed extra padding after closing table')
            lastTableStateRef.current = currentTableState
            return
          }
          // If only table maximized change, do nothing further
          if (isTableStateChange && tableMaximized && !isSignificantChange && !isFirstLoad && !isRowSelection) {
            console.log('Table maximized – no map adjustment')
            lastTableStateRef.current = currentTableState
            return
          }
        if (featuresToShow.length > 0) {
          const bounds = calculateBounds(featuresToShow)
          if (bounds && map.current) {
            // Calculate padding based on table and filter nav state
            const calculatePadding = () => {
              const basePadding = 60
              let bottomPadding = basePadding
              let leftPadding = basePadding
              
              // Add left padding for filter nav
              const filterWidth = isFilterCollapsed ? 48 : 350
              leftPadding = filterWidth + 30
              
              // Add extra bottom padding when table is visible but not maximized
              if (tableVisible && !tableMaximized) {
                // Table height is h-72 (288px) + header + padding = ~320px
                bottomPadding = 350 // Extra space to ensure points are clearly visible above table
              } else if (tableVisible && tableMaximized) {
                // 75vh for maximized table
                bottomPadding = window.innerHeight * 0.75 + 30
              }
              
              return {
                top: basePadding,
                bottom: bottomPadding,
                left: leftPadding,
                right: basePadding
              }
            }
            
            // Use fitBounds with smart padding
            map.current.fitBounds(bounds, {
              padding: calculatePadding(),
              duration: 1200, // Smooth 1.2 second animation
              easing: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1, // easeInOutCubic
              maxZoom: featuresToShow.length === 1 ? 10 : 12 // Don't zoom too close for single points
            })
            console.log('Map bounds animated to fit', featuresToShow.length, 'features', 
              tableVisible && !tableMaximized ? '(adjusted for table)' : '',
              isTableStateChange ? '(table state changed)' : '')
          }
        } else if (lastCount > 0 && !isTableStateChange) {
          // If we had features but now have none, zoom out to show full extent
          map.current.flyTo({
            center: [-98.5795, 39.8283], // Center of USA
            zoom: 3.8,
            pitch: 0, // Maintain 2D view
            bearing: 0, // Keep north orientation
            duration: 1200,
            easing: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
          })
          console.log('Map zoomed out - no features to display')
        }
        
        lastFeaturesCountRef.current = currentCount
        lastTableStateRef.current = currentTableState
      }
    }, 300) // 300ms debounce to prevent rapid animations
  }, [filteredFeatures, selectedRows, tableVisible, tableMaximized, isFilterCollapsed, isMapFullyReady, isAutoFitEnabled, calculateBounds])

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/myamamabe21igis/cmdavzz7q00y101qu0x5fgubh",
      center: [-98.5795, 39.8283], // Center of USA
      zoom: 3.8, // Proper initial zoom for USA view
   //   minZoom: 2, // Allow slightly more zooming out (wider than continental US)
      maxZoom: 14, // Prevent over-zooming into streets
      pitch: 0,
      bearing: 0,
      antialias: true,
      pitchWithRotate: false,
      dragRotate: false, // Disable rotation for pure 2D experience
      touchZoomRotate: false, // Disable touch rotation
      doubleClickZoom: true,
      keyboard: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
      renderWorldCopies: false,
      refreshExpiredTiles: true,
      projection: 'mercator' // Force 2D Mercator projection
    })

    // Add navigation control
    const nav = new mapboxgl.NavigationControl({
      showCompass: false, // Hide compass for 2D map
      showZoom: true,
      visualizePitch: false // Disable pitch visualization for 2D
    })
    map.current.addControl(nav, "top-right")

    // Custom auto-fit bounds control
    class AutoFitControl {
      private _container: HTMLDivElement | undefined
      private _button: HTMLButtonElement | undefined

      onAdd() {
        this._container = document.createElement('div')
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group'
        
        this._button = document.createElement('button')
        this._button.className = 'mapboxgl-ctrl-icon'
        this._button.type = 'button'
        this._button.title = 'Auto-fit to filtered data'
        this._button.setAttribute('aria-label', 'Auto-fit to filtered data')
        
        // Target/focus icon for auto-fitting
        this._button.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
          </svg>
        `
        
        this._updateStyle(isAutoFitEnabled)
        
        this._button.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsAutoFitEnabled(prev => !prev)
        })
        
        this._container.appendChild(this._button)
        return this._container
      }

      onRemove() {
        if (this._container && this._container.parentNode) {
          this._container.parentNode.removeChild(this._container)
        }
      }

      _updateStyle(active: boolean) {
        if (this._button) {
          this._button.style.cssText = `
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${active ? '#8187FF' : '#fff'};
            border: 0;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 0 0 2px rgba(0,0,0,.1);
          `
          
          const svg = this._button.querySelector('svg')
          if (svg) {
            svg.style.color = active ? '#fff' : '#8187FF';
          }
        }
      }

      updateState(active: boolean) {
        this._updateStyle(active)
      }
    }



    // Handle map load
    map.current.on('load', () => {
      setIsMapLoading(false)
      setIsMapFullyReady(true) // Set map fully ready after load
      
      // Initialize table state ref
      lastTableStateRef.current = { visible: tableVisible, maximized: tableMaximized }
      
      if (map.current) {
        // Add custom controls after load and store references
        const autoFitControl = new AutoFitControl()
        autoFitControlRef.current = autoFitControl
        map.current.addControl(autoFitControl, "top-right")

        // ✅ 1. Add clustered source (will be populated when data loads)
        map.current.addSource('points', {
          type: 'geojson',
          data: {
            type: "FeatureCollection",
            features: []
          },
          cluster: true,
          clusterMaxZoom: 11, // Increased for smoother breakdown (was 10)
          clusterRadius: 40,  // Slightly smaller for better separation and smoother transitions
          clusterProperties: {
            // Add smooth text transitions
            'point_count_abbreviated': ['+', ['get', 'point_count']]
          }
        })
        
        // ✅ 2. Add outer ring layer for clusters (lighter purple ring)
        map.current.addLayer({
          id: 'clusters-outer',
          type: 'circle',
          source: 'points',
          filter: ['has', 'point_count'], // only show clusters
          maxzoom: 14,
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#B7BEFF',    // < 50 points - darker for better visibility
              50, '#BEC4FF',  // 50-100 points 
              100, '#C5CAFF', // 100-500 points
              500, '#C0C5FF'  // 500+ points - slightly darker for zoomed out view
            ],
            'circle-radius': [
              'interpolate',
              ['exponential', 1.2], // Smoother exponential interpolation
              ['zoom'],
              8, ['*', ['step', ['get', 'point_count'], 18, 50, 24, 100, 30, 500, 36], 0.7],
              12, ['step', ['get', 'point_count'], 18, 50, 24, 100, 30, 500, 36],
              16, ['*', ['step', ['get', 'point_count'], 18, 50, 24, 100, 30, 500, 36], 1.3]
            ],
            'circle-opacity': 1,
            'circle-opacity-transition': { duration: 0 }
          }
        })

        // Add inner circle layer for clusters (lighter main purple)
        map.current.addLayer({
          id: 'clusters-inner',
          type: 'circle',
          source: 'points',
          filter: ['has', 'point_count'], // only show clusters
          maxzoom: 14,
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#8884fc',    // < 50 points - user specified purple
              50, '#8884fc',  // 50-100 points
              100, '#8884fc', // 100-500 points
              500, '#8884fc'  // 500+ points - consistent color
            ],
            'circle-radius': [
              'interpolate',
              ['exponential', 1.2], // Smoother exponential interpolation
              ['zoom'],
              8, ['*', ['step', ['get', 'point_count'], 12, 50, 16, 100, 20, 500, 24], 0.7],
              12, ['step', ['get', 'point_count'], 12, 50, 16, 100, 20, 500, 24],
              16, ['*', ['step', ['get', 'point_count'], 12, 50, 16, 100, 20, 500, 24], 1.3]
            ],
            'circle-opacity': 1,
            'circle-opacity-transition': { duration: 0 }
          }
        })

        // Add cluster count label (text)
        map.current.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'points',
          filter: ['has', 'point_count'],
          maxzoom: 14,
          layout: {
            'text-field': [
              'case',
              ['>=', ['get', 'point_count'], 10000],
              ['concat', ['floor', ['/', ['get', 'point_count'], 1000]], 'k+'],
              ['>=', ['get', 'point_count'], 1000],
              ['concat', ['floor', ['/', ['get', 'point_count'], 1000]], 'k'],
              ['to-string', ['get', 'point_count']]
            ],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': [
              'interpolate',
              ['exponential', 1.2], // Smoother text scaling
              ['zoom'],
              8, ['*', ['step', ['get', 'point_count'], 11, 50, 12, 100, 13, 500, 14], 0.8],
              12, ['step', ['get', 'point_count'], 11, 50, 12, 100, 13, 500, 14],
              16, ['*', ['step', ['get', 'point_count'], 11, 50, 12, 100, 13, 500, 14], 1.4]
            ],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-anchor': 'center',
            'text-justify': 'center'
          },
          paint: {
            'text-color': '#ffffff', // White text
            'text-halo-color': 'rgba(107, 115, 255, 0.7)', // Purple halo for contrast
            'text-halo-width': 1.5,
            'text-opacity': 1,
            'text-opacity-transition': { duration: 0 }
          }
        })

        // Add individual points layer (shown when not clustered)
        map.current.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'points',
          filter: ['!', ['has', 'point_count']], // only show individual points
          paint: {
            'circle-color': selectedRows.size > 0 ? '#FD8408' : '#8187FF', // Orange for selected, purple for normal
            'circle-radius': 8, // Same size for both selected and normal
            'circle-stroke-width': 3, // Same stroke width for both
            'circle-stroke-color': '#ffffff'
          }
        })

        // ✅ 6. Add click handler to zoom into cluster (for both layers)
        const handleClusterClick = (e: mapboxgl.MapMouseEvent) => {
          const features = map.current!.queryRenderedFeatures(e.point, {
            layers: ['clusters-outer', 'clusters-inner']
          })

          if (features.length > 0 && features[0].properties && features[0].geometry) {
            const rawClusterId = features[0].properties.cluster_id
            if (typeof rawClusterId === 'number') {
              const clusterId: number = rawClusterId
              const source = map.current!.getSource('points') as mapboxgl.GeoJSONSource
              const pointGeometry = features[0].geometry as GeoJSON.Point
              const currentZoom: number = map.current!.getZoom() || 8
              const pointCount: number = features[0].properties.point_count || 1
              
              source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err || zoom === null || zoom === undefined || !map.current) return

                // Smart zoom calculation to prevent over-zooming
                const maxZoom = 14 // Reasonable maximum zoom level
                let targetZoom = Math.min(zoom, maxZoom)
                
                // For large clusters, don't zoom as aggressively
                if (pointCount > 100) {
                  targetZoom = Math.min(targetZoom, currentZoom + 3)
                } else if (pointCount > 50) {
                  targetZoom = Math.min(targetZoom, currentZoom + 4)
                } else {
                  targetZoom = Math.min(targetZoom, currentZoom + 5)
                }

                // Ensure we zoom in at least a little bit
                targetZoom = Math.max(targetZoom, currentZoom + 1)
                
                // Get cluster children to calculate better bounds
                source.getClusterChildren(clusterId, (childErr, children) => {
                  if (childErr || !children) {
                    // Fallback: simple zoom to point
                    map.current!.easeTo({
                      center: pointGeometry.coordinates as [number, number],
                      zoom: targetZoom,
                      duration: 600,
                      easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic for natural feel
                      pitch: 0,
                      bearing: 0
                    })
                    return
                  }

                  // Calculate bounds from cluster children for better fit
                  const childCoords = children
                    .filter(child => child.geometry && child.geometry.type === 'Point')
                    .map(child => (child.geometry as GeoJSON.Point).coordinates as [number, number])

                  if (childCoords.length > 1) {
                    // Create bounds from all child points
                    const bounds = new mapboxgl.LngLatBounds()
                    childCoords.forEach(coord => bounds.extend(coord))
                    
                    // Add some padding around the bounds
                    const padding = 60
                    
                    // Use fitBounds for better view of cluster breakdown
                    map.current!.fitBounds(bounds, {
                      padding,
                      duration: 700, // Slightly longer for smooth transition
                      easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
                      maxZoom: targetZoom // Prevent over-zooming
                    })
                  } else {
                    // Single point or fallback
                map.current!.easeTo({
                  center: pointGeometry.coordinates as [number, number],
                      zoom: targetZoom,
                      duration: 600,
                      easing: (t) => 1 - Math.pow(1 - t, 3),
                      pitch: 0,
                      bearing: 0
                    })
                  }
                })
              })
            }
          }
        }

        map.current.on('click', 'clusters-outer', handleClusterClick)
        map.current.on('click', 'clusters-inner', handleClusterClick)

        // Add click handler for individual points
        map.current.on('click', 'unclustered-point', (e) => {
          if (!e.features || e.features.length === 0) return
          
          const feature = e.features[0]
          if (!feature.geometry || !feature.properties) return
          
          // Popup disabled temporarily
          /*
          const pointGeometry = feature.geometry as GeoJSON.Point
          const coordinates = pointGeometry.coordinates.slice() as [number, number]
          const properties = feature.properties
          
          // Ensure popup appears above the point
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
          }

          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
             <div class="p-3">
               <h3 class="font-semibold text-sm mb-2">${properties.pipeline_name || 'Pipeline Point'}</h3>
               <div class="space-y-1 text-xs">
                 <div><strong>PIX:</strong> ${properties.pix || 'N/A'}</div>
                 <div><strong>Business Unit:</strong> ${properties.business_unit || 'N/A'}</div>
                 <div><strong>System:</strong> ${properties.system_name || 'N/A'}</div>
                 <div><strong>Route:</strong> ${properties.route_number || 'N/A'}</div>
                 ${properties.gnis_name ? `<div><strong>GNIS Name:</strong> ${properties.gnis_name}</div>` : ''}
                 <div><strong>Flow (qema):</strong> ${properties.qema ? Number(properties.qema).toFixed(3) : 'N/A'}</div>
                 <div><strong>Velocity (vema):</strong> ${properties.vema ? Number(properties.vema).toFixed(3) : 'N/A'}</div>
               </div>
             </div>
           `)
           .addTo(map.current!)
          */
        })

        // Change cursor on hover for clusters
        map.current.on('mouseenter', 'clusters-outer', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'clusters-outer', () => {
          map.current!.getCanvas().style.cursor = ''
        })
        map.current.on('mouseenter', 'clusters-inner', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'clusters-inner', () => {
          map.current!.getCanvas().style.cursor = ''
        })
        map.current.on('mouseenter', 'unclustered-point', () => {
          map.current!.getCanvas().style.cursor = 'pointer'
        })
        map.current.on('mouseleave', 'unclustered-point', () => {
          map.current!.getCanvas().style.cursor = ''
        })
        
        // Remove the delayed animation that causes data to appear late
        // Data should appear immediately when map loads
        console.log('Map initialized and ready for immediate data')
      }
    })

    // Error handling
    map.current.on('error', (e) => {
      console.warn('Mapbox error:', e.error)
      setIsMapLoading(false)
    })

    return () => {
      // Clear any pending bounds animation
      if (boundsAnimationTimeoutRef.current) {
        clearTimeout(boundsAnimationTimeoutRef.current)
        boundsAnimationTimeoutRef.current = null
      }
      
      // Reset map ready state
      setIsMapFullyReady(false)
      
      if (map.current) {
        if (autoFitControlRef.current) {
          map.current.removeControl(autoFitControlRef.current)
          autoFitControlRef.current = null
        }
        map.current.remove()
        map.current = null
      }
    }
  
  }, [setIsMapLoading, createGeoJSONFromFeatures])

  // Update auto-fit control state
  useEffect(() => {
    if (autoFitControlRef.current) {
      autoFitControlRef.current.updateState(isAutoFitEnabled)
    }
  }, [isAutoFitEnabled])

  // Update point styling when selected rows change
  useEffect(() => {
    if (!map.current || loading) return

    if (map.current.getLayer('unclustered-point')) {
      // Update point styling based on selection state
      map.current.setPaintProperty('unclustered-point', 'circle-color', 
        selectedRows.size > 0 ? '#FD8408' : '#8187FF')
      // No need to update radius or stroke-width since they're now the same for both states
    }
  }, [selectedRows, loading])

  // This effect is now handled in the main bounds effect above to prevent duplicate animations

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div 
        ref={mapContainer} 
        className="w-full h-full mapbox-container"
      />

      {/* Loading spinner */}
      {isMapLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-[#8187FF] rounded-full animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Search Controls Overlay - positioned to avoid filter toolbar collision */}
      <div className={cn(
        "absolute top-4 z-20 transition-all duration-300 ease-in-out",
        // Desktop positioning based on filter state, mobile positioning on right side
        "md:left-auto", 
        isFilterCollapsed ? "md:left-16" : "md:left-[370px]",
        "right-4 md:right-auto" // Mobile: right side, Desktop: left side based on filter
      )}>
        <MapSearch onLocationSelect={handleLocationSelect} />
      </div>
    </div>
  )
}

export const MapView = memo(MapViewComponent)
