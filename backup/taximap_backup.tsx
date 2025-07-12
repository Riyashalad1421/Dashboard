"use client"

import type React from "react"
import { useState } from "react"
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
  iconRetinaUrl: "leaflet/images/marker-icon-2x.png",
  iconUrl: "leaflet/images/marker-icon.png",
  shadowUrl: "leaflet/images/marker-shadow.png",
})

// Custom icon factory for MarkerClusterGroup
const createClusterCustomIcon = (cluster: L.MarkerCluster) => {
  const count = cluster.getChildCount()
  let size = "small"
  let colorClass = "bg-green-600" // Default for small clusters

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
    html: `<div class="flex items-center justify-center text-white font-bold text-lg ${colorClass} rounded-full" style="width: 40px; height: 40px;"><span>${count}</span></div>`,
    className: `marker-cluster marker-cluster-${size}`,
    iconSize: L.point(40, 40),
  })
}

const BeijingTaxiMap: React.FC = () => {
  const { activeTaxis } = useTaxiDataContext()
  const [selectedTaxi, setSelectedTaxi] = useState<Taxi | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleMarkerClick = (taxi: Taxi) => {
    setSelectedTaxi(taxi)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTaxi(null)
  }

  const center: [number, number] = [39.9042, 116.4074] // Beijing lat/lon
  const zoom = 12

  return (
    <>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full rounded-lg shadow-lg"
        attributionControl={false} // Hide default Leaflet attribution
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CartoDB</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapBoundsUpdater />
        {/* Implement Marker Clustering with custom icon factory */}
        <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterCustomIcon}>
          {activeTaxis.map((taxi) => (
            <TaxiMarker key={taxi.id} taxi={taxi} onClick={handleMarkerClick} />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      <TaxiDetailsModal isOpen={isModalOpen} onClose={handleCloseModal} taxi={selectedTaxi} />
    </>
  )
}

export default BeijingTaxiMap
