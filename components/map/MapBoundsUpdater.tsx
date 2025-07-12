"use client"

import { useMapEvents } from "react-leaflet"
import { useTaxiDataContext } from "@/context/taxi-data-context"
import { useEffect } from "react"

export function MapBoundsUpdater() {
  const { setMapBounds } = useTaxiDataContext()

  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds()
      setMapBounds({
        northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      })
    },
    zoomend: () => {
      const bounds = map.getBounds()
      setMapBounds({
        northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      })
    },
  })

  // Set initial bounds when map loads
  useEffect(() => {
    const bounds = map.getBounds()
    setMapBounds({
      northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
      southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
    })
  }, [map, setMapBounds])

  return null // This component doesn't render anything visible
}
