"use client"

import React, { createContext, useState, useEffect, useContext } from "react"
import { useWebSocket } from "@/lib/websocket"
import type { Taxi, MapBounds } from "@/lib/types"

interface TaxiDataContextType {
  activeTaxis: Taxi[]
  totalTaxis: number // Total unique taxis seen (global)
  totalActiveTaxis: number // Active taxis in viewport
  totalAverageSpeed: number // Avg speed of taxis in viewport
  totalViolations: number // Total violations of taxis in viewport
  setMapBounds: (bounds: MapBounds) => void
}

const TaxiDataContext = createContext<TaxiDataContextType | undefined>(undefined)

const ACTIVE_THRESHOLD_MS = 30 * 1000 // 30 seconds

export function TaxiDataProvider({ children }: { children: React.ReactNode }) {
  const { latestData } = useWebSocket()
  const [activeTaxis, setActiveTaxis] = useState<Taxi[]>([])
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)

  const [totalTaxis, setTotalTaxis] = useState(0) // Global count
  const [totalAverageSpeed, setTotalAverageSpeed] = useState(0) // Viewport-based
  const [totalViolations, setTotalViolations] = useState(0) // Viewport-based

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const currentRawTaxis = latestData() // All latest raw data
      const newActiveTaxisInViewport: Taxi[] = []
      let cumulativeViolationsInViewport = 0
      let cumulativeSpeedInViewport = 0
      let activeTaxiCountInViewport = 0

      currentRawTaxis.forEach((rawTaxi) => {
        const lastUpdate = new Date(rawTaxi.date_time).getTime()
        if (now - lastUpdate <= ACTIVE_THRESHOLD_MS) {
          // Ensure avg_speed and violations are numbers, defaulting to 0 if NaN or undefined/null
          // NOTE: These avg_speed and violations are from the WebSocket stream.
          // If your WebSocket does not provide them, they will be 0 here.
          const avgSpeed = Number(rawTaxi.avg_speed)
          const violations = Number(rawTaxi.violations)

          // Check if taxi is within current map bounds for rendering AND metrics
          const isInBounds =
            !mapBounds ||
            (rawTaxi.latitude >= mapBounds.southWest.lat &&
              rawTaxi.latitude <= mapBounds.northEast.lat &&
              rawTaxi.longitude >= mapBounds.southWest.lng &&
              rawTaxi.longitude <= mapBounds.northEast.lng)

          if (isInBounds) {
            newActiveTaxisInViewport.push({
              id: rawTaxi.taxi_id,
              lastUpdate: new Date(lastUpdate),
              longitude: rawTaxi.longitude,
              latitude: rawTaxi.latitude,
              avgSpeed: isNaN(avgSpeed) ? 0 : avgSpeed,
              violations: isNaN(violations) ? 0 : violations,
            })
            cumulativeSpeedInViewport += isNaN(avgSpeed) ? 0 : avgSpeed
            cumulativeViolationsInViewport += isNaN(violations) ? 0 : violations
            activeTaxiCountInViewport++
          }
        }
      })
      setActiveTaxis(newActiveTaxisInViewport) // Only taxis in viewport
      setTotalTaxis(currentRawTaxis.size) // Total unique taxis ever seen (global)
      setTotalAverageSpeed(activeTaxiCountInViewport > 0 ? cumulativeSpeedInViewport / activeTaxiCountInViewport : 0)
      setTotalViolations(cumulativeViolationsInViewport)
    }, 1000)

    return () => clearInterval(interval)
  }, [latestData, mapBounds])

  const contextValue = React.useMemo(
    () => ({
      activeTaxis,
      totalTaxis,
      totalActiveTaxis: activeTaxis.length, // Count of taxis in viewport
      totalAverageSpeed,
      totalViolations,
      setMapBounds,
    }),
    [activeTaxis, totalTaxis, totalAverageSpeed, totalViolations, setMapBounds],
  )

  return <TaxiDataContext.Provider value={contextValue}>{children}</TaxiDataContext.Provider>
}

export function useTaxiDataContext() {
  const context = useContext(TaxiDataContext)
  if (context === undefined) {
    throw new Error("useTaxiDataContext must be used within a TaxiDataProvider")
  }
  return context
}
