"use client"

import { useState, useEffect } from "react"
import { useMapEvents } from "react-leaflet"
import { useWebSocket } from "./use-websocket"
import type { Taxi, MapBounds } from "@/lib/types"

const ACTIVE_THRESHOLD_MS = 30 * 1000 // 30 seconds

export function useTaxiData() {
  const { latestData } = useWebSocket()
  const [activeTaxis, setActiveTaxis] = useState<Taxi[]>([])
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [map, setMap] = useState<any>(null)

  // Get map instance to update bounds
  const mapEvents = useMapEvents({
    moveend: () => {
      if (map) {
        const bounds = map.getBounds()
        setMapBounds({
          northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
          southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
        })
      }
    },
    zoomend: () => {
      if (map) {
        const bounds = map.getBounds()
        setMapBounds({
          northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
          southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
        })
      }
    },
    load: () => {
      setMap(mapEvents.target)
    },
  })

  useEffect(() => {
    if (map) {
      // Initialize map bounds on first render
      const bounds = map.getBounds()
      setMapBounds({
        northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng },
        southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
      })
    }
  }, [map])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const currentTaxis = latestData()
      const newActiveTaxis: Taxi[] = []

      currentTaxis.forEach((rawTaxi) => {
        const lastUpdate = new Date(rawTaxi.date_time).getTime()
        if (now - lastUpdate <= ACTIVE_THRESHOLD_MS) {
          // Check if taxi is within current map bounds
          if (
            mapBounds &&
            rawTaxi.latitude >= mapBounds.southWest.lat &&
            rawTaxi.latitude <= mapBounds.northEast.lat &&
            rawTaxi.longitude >= mapBounds.southWest.lng &&
            rawTaxi.longitude <= mapBounds.northEast.lng
          ) {
            newActiveTaxis.push({
              id: rawTaxi.taxi_id,
              lastUpdate: new Date(lastUpdate),
              longitude: rawTaxi.longitude,
              latitude: rawTaxi.latitude,
            })
          }
        }
      })
      setActiveTaxis(newActiveTaxis)
    }, 1000) // Update active taxis every second

    return () => clearInterval(interval)
  }, [latestData, mapBounds, map])

  return { activeTaxis, totalActiveTaxis: activeTaxis.length }
}
