// components/map/TaxiMap.tsx - QUICK FIX FOR AUTO-DESELECTION
"use client"

import type React from "react"
import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet"
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

// Optimized cluster icon factory
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
    html: `<div class="cluster-icon ${colorClass}" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 0 10px rgba(0,0,0,0.5);">${count}</div>`,
    className: `marker-cluster marker-cluster-${size}`,
    iconSize: L.point(40, 40),
  })
}

interface BeijingTaxiMapProps {
  selectedTaxi?: Taxi | null
  onTaxiDeselect?: () => void
}

// MODIFIED: Component to handle map events - ONLY deselect on DOUBLE CLICK to avoid accidental deselection
function MapEventHandler({ onTaxiDeselect }: { onTaxiDeselect?: () => void }) {
  const map = useMapEvents({
    // REMOVED: zoomstart and movestart auto-deselection
    dblclick: () => {
      // Only deselect on double click
      if (onTaxiDeselect) {
        console.log('🗺️ MAP: Double click detected - deselecting taxi')
        onTaxiDeselect()
      }
    }
  })
  return null
}

const BeijingTaxiMap: React.FC<BeijingTaxiMapProps> = ({ selectedTaxi, onTaxiDeselect }) => {
  const { activeTaxis, totalActiveTaxis, isConnected, dataProcessingTime } = useTaxiDataContext()
  const [modalSelectedTaxi, setModalSelectedTaxi] = useState<Taxi | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const mapRef = useRef<L.Map | null>(null)

  const taxisToRender = activeTaxis || []

  // Debug logs
  console.log('🗺️ MAP: Received selectedTaxi prop:', selectedTaxi?.id || 'null')

  useEffect(() => {
    if (isConnected) {
      setMapKey(prev => prev + 1)
    }
  }, [isConnected])

  // Center map on selected taxi
  useEffect(() => {
    if (selectedTaxi && mapRef.current) {
      const map = mapRef.current
      console.log('🎯 MAP: Flying to taxi', selectedTaxi.id)
      map.flyTo([selectedTaxi.latitude, selectedTaxi.longitude], Math.max(map.getZoom(), 15), {
        duration: 1.5,
        easeLinearity: 0.25
      })
    }
  }, [selectedTaxi?.id])

  const handleMarkerClick = useCallback((taxi: Taxi) => {
    setModalSelectedTaxi(taxi)
    setIsModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setModalSelectedTaxi(null)
  }, [])

  const taxiMarkers = useMemo(() => {
    console.log('🗺️ MAP: Creating markers for', taxisToRender.length, 'taxis')
    console.log('🗺️ MAP: Looking for selected taxi ID:', selectedTaxi?.id || 'null')
    
    if (!taxisToRender || taxisToRender.length === 0) {
      return []
    }

    return taxisToRender.map((taxi) => {
      const isCurrentlySelected = selectedTaxi?.id === taxi.id
      
      if (isCurrentlySelected) {
        console.log('🌟 MAP: FOUND MATCH! Taxi', taxi.id, 'will be highlighted')
      }
      
      return (
        <TaxiMarker 
          key={`taxi-marker-${taxi.id}`}
          taxi={taxi} 
          onClick={handleMarkerClick}
          isSelected={isCurrentlySelected}
        />
      )
    })
  }, [taxisToRender, selectedTaxi?.id, handleMarkerClick])

  const center: [number, number] = [39.9042, 116.4074]
  const zoom = 12

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
        <div className="absolute top-2 right-2 z-[1000] bg-black/80 text-white text-xs px-2 py-1 rounded">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            <span>|</span>
            <span>{totalActiveTaxis || 0} taxis</span>
            {selectedTaxi && (
              <>
                <span>|</span>
                <span className="text-yellow-400">🎯 Selected: {selectedTaxi.id}</span>
              </>
            )}
          </div>
        </div>

        {/* Manual deselect button when taxi is selected */}
        {selectedTaxi && onTaxiDeselect && (
          <div className="absolute top-14 right-2 z-[1000]">
            <button
              onClick={() => {
                console.log('🗺️ MAP: Manual deselect button clicked')
                onTaxiDeselect()
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium"
            >
              <span>Deselect Taxi {selectedTaxi.id}</span>
              <span className="text-lg">×</span>
            </button>
          </div>
        )}

        {/* Instructions */}
        {selectedTaxi && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-blue-600/90 text-white text-xs px-3 py-2 rounded-lg">
            <div className="font-semibold">Taxi {selectedTaxi.id} Selected</div>
            <div>Double-click map or use button to deselect</div>
          </div>
        )}

        {/* Debug info */}
        <div className="absolute top-2 left-2 z-[1000] bg-black/80 text-white text-xs px-2 py-1 rounded">
          <div>Markers: {taxiMarkers.length}</div>
          <div>Selected: {selectedTaxi?.id || 'None'}</div>
          <div>Highlighted: {taxiMarkers.filter(m => m.props.isSelected).length}</div>
        </div>

        <MapContainer
          key={mapKey}
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          className="rounded-lg shadow-lg"
          attributionControl={true}
          preferCanvas={true}
          updateWhenZooming={false}
          updateWhenIdle={true}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            updateWhenIdle={true}
            updateWhenZooming={false}
          />
          <MapBoundsUpdater />
          <MapEventHandler onTaxiDeselect={onTaxiDeselect} />

          {taxiMarkers.length > 0 && (
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              maxClusterRadius={50}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
              animate={false}
              animateAddingMarkers={false}
            >
              {taxiMarkers}
            </MarkerClusterGroup>
          )}
        </MapContainer>
      </div>

      <TaxiDetailsModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        taxi={modalSelectedTaxi} 
      />
    </>
  )
}

export default BeijingTaxiMap