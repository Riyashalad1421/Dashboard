"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect } from "react"
import { MapContainer, TileLayer } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import TaxiMarker from "./TaxiMarker"
import { useTaxiDataContext } from "@/context/taxi-data-context"
import { MapBoundsUpdater } from "./MapBoundsUpdater"
import { TaxiDetailsModal } from "@/components/dashboard/TaxiDetailsModal"
import type { Taxi } from "@/lib/types"
import MarkerClusterGroup from "react-leaflet-cluster"
import L from "leaflet"

// Fix for default Leaflet icon issues with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
})

// Optimized cluster icon factory with better performance
const createClusterCustomIcon = (cluster: L.MarkerCluster) => {
  const count = cluster.getChildCount()
  let size = "small"
  let colorClass = "bg-green-600"

  if (count < 10) {
    size = "small"
    colorClass = "bg-green-600"
  } else if (count < 100) {
    size = "medium"
    colorClass = "bg-yellow-600"
  } else {
    size = "large"
    colorClass = "bg-red-600"
  }

  return new L.DivIcon({
    html: `<div class="cluster-icon ${colorClass}" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; font-weight: bold; font-size: 14px;">${count}</div>`,
    className: `marker-cluster marker-cluster-${size}`,
    iconSize: L.point(40, 40),
  })
}

const BeijingTaxiMap: React.FC = () => {
  const { activeTaxis, totalActiveTaxis, isConnected, dataProcessingTime } = useTaxiDataContext()
  const [selectedTaxi, setSelectedTaxi] = useState<Taxi | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [mapKey, setMapKey] = useState(0) // Force map re-render

  // Mock data for testing (remove this once real data is working)
  const mockTaxis: Taxi[] = [
    { id: 'mock-1', latitude: 39.9042, longitude: 116.4074, violations: 0 },
    { id: 'mock-2', latitude: 39.9142, longitude: 116.4174, violations: 1 },
    { id: 'mock-3', latitude: 39.8942, longitude: 116.3974, violations: 0 },
  ]
  
  // Use mock data if no real data is available
  const taxisToRender = activeTaxis?.length > 0 ? activeTaxis : mockTaxis

  // Debug logging
  useEffect(() => {
    console.log('🚗 Taxi Data Debug:', {
      activeTaxis: activeTaxis?.length || 0,
      totalActiveTaxis,
      isConnected,
      sampleTaxi: activeTaxis?.[0],
      usingMockData: !activeTaxis?.length
    })
  }, [activeTaxis, totalActiveTaxis, isConnected])

  // Force map refresh on connection changes
  useEffect(() => {
    if (isConnected) {
      setMapKey(prev => prev + 1)
    }
  }, [isConnected])

  // Memoize marker click handler to prevent unnecessary re-renders
  const handleMarkerClick = useCallback((taxi: Taxi) => {
    setSelectedTaxi(taxi)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedTaxi(null)
  }, [])

  // Memoize taxi markers to prevent unnecessary re-renders
  const taxiMarkers = useMemo(() => {
    if (!taxisToRender || taxisToRender.length === 0) {
      console.log('🗺️ No active taxis to render')
      return []
    }
    
    console.log(`🗺️ Rendering ${taxisToRender.length} taxi markers (Processing time: ${dataProcessingTime?.toFixed(2) || 0}ms)`)
    
    return taxisToRender.map((taxi) => (
      <TaxiMarker key={taxi.id} taxi={taxi} onClick={handleMarkerClick} />
    ))
  }, [taxisToRender, handleMarkerClick, dataProcessingTime])

  const center: [number, number] = [39.9042, 116.4074] // Beijing lat/lon
  const zoom = 12

  // If no data, show a message
  if (!isConnected) {
    return (
      <div className="relative h-full w-full bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p>Connecting to taxi data stream...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative h-full w-full">
        {/* Performance indicator */}
        <div className="absolute top-2 right-2 z-[1000] bg-black/80 text-white text-xs px-2 py-1 rounded">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            <span>|</span>
            <span>{totalActiveTaxis || 0} taxis</span>
            <span>|</span>
            <span>{dataProcessingTime?.toFixed(1) || 0}ms</span>
          </div>
        </div>

        {/* Debug info */}
        <div className="absolute top-12 right-2 z-[1000] bg-black/80 text-white text-xs px-2 py-1 rounded">
          <div>Markers: {taxiMarkers.length}</div>
        </div>

        <MapContainer
          key={mapKey} // Force re-render when key changes
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }} // Explicit style
          className="rounded-lg shadow-lg"
          attributionControl={true} // Enable attribution for debugging
          // Optimize map performance
          preferCanvas={true}
          updateWhenZooming={false}
          updateWhenIdle={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            // Optimize tile loading
            updateWhenIdle={true}
            updateWhenZooming={false}
          />
          <MapBoundsUpdater />
          
          {/* Render markers with or without clustering */}
          {taxiMarkers.length > 0 && (
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              // Clustering options for better performance
              maxClusterRadius={50}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
              // Performance optimizations
              animate={false} // Disable animations for better performance
              animateAddingMarkers={false}
            >
              {taxiMarkers}
            </MarkerClusterGroup>
          )}

          {/* Fallback: render markers without clustering if clustering fails */}
          {taxiMarkers.length === 0 && taxisToRender?.length > 0 && (
            <>
              {taxisToRender.slice(0, 10).map((taxi) => (
                <TaxiMarker key={`fallback-${taxi.id}`} taxi={taxi} onClick={handleMarkerClick} />
              ))}
            </>
          )}
        </MapContainer>
      </div>
      
      <TaxiDetailsModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        taxi={selectedTaxi} 
      />
    </>
  )
}

export default BeijingTaxiMap