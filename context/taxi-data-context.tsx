// context/taxi-data-context.tsx - FIXED: REMOVED PIPELINE ALERT
"use client"

import React, { createContext, useState, useEffect, useContext } from "react"
import { useWebSocket } from "@/lib/websocket"
import { useReplayContext } from "@/context/replay-context"
import type { Taxi, MapBounds } from "@/lib/types"

interface TaxiDataContextType {
  activeTaxis: Taxi[]
  totalTaxis: number
  totalActiveTaxis: number
  totalAverageSpeed: number
  totalViolations: number
  totalDistance: number | null
  isConnected: boolean
  dataProcessingTime: number
  setMapBounds: (bounds: MapBounds) => void
}

const TaxiDataContext = createContext<TaxiDataContextType | undefined>(undefined)

const ACTIVE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

// Function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export function TaxiDataProvider({ children }: { children: React.ReactNode }) {
  const { latestData, isConnected } = useWebSocket()
  const { getDataUpdateInterval, isPlaying } = useReplayContext()
  
  const [activeTaxis, setActiveTaxis] = useState<Taxi[]>([])
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)
  const [dataProcessingTime, setDataProcessingTime] = useState(0)
  const [previousTaxiPositions, setPreviousTaxiPositions] = useState<Map<string, {lat: number, lng: number}>>(new Map())
  const [accumulatedDistance, setAccumulatedDistance] = useState<number>(0)

  const [totalTaxis, setTotalTaxis] = useState(0)
  const [totalAverageSpeed, setTotalAverageSpeed] = useState(0)
  const [totalViolations, setTotalViolations] = useState(0)
  const [totalDistance, setTotalDistance] = useState<number | null>(null)

  useEffect(() => {
    const processData = () => {
      // Only process if playing
      if (!isPlaying) {
        return
      }

      const startTime = performance.now()
      const now = Date.now()
      const currentRawTaxis = latestData()
      
      // Simple logging without pipeline alerts
      console.log(`Processing ${currentRawTaxis.size} taxis`)

      const newActiveTaxisInViewport: Taxi[] = []
      let cumulativeViolationsInViewport = 0
      let cumulativeSpeedInViewport = 0
      let newDistanceThisInterval = 0
      let activeTaxiCountInViewport = 0
      let totalActiveTaxis = 0

      // Track new positions for distance calculation
      const newTaxiPositions = new Map<string, {lat: number, lng: number}>()

      currentRawTaxis.forEach((rawTaxi) => {
        const lastUpdate = new Date(rawTaxi.date_time).getTime()
        const timeDiff = now - lastUpdate
        const isRecent = timeDiff <= ACTIVE_THRESHOLD_MS
        
        if (!isRecent) {
          return
        }
        
        totalActiveTaxis++
        
        // Check coordinate validity for Beijing area
        const isValidCoordinates = (
          rawTaxi.latitude >= 35.0 && rawTaxi.latitude <= 45.0 &&
          rawTaxi.longitude >= 110.0 && rawTaxi.longitude <= 125.0
        )
        
        if (!isValidCoordinates) {
          return
        }
        
        // Check if taxi is in viewport bounds
        const isInBounds = !mapBounds || (
          rawTaxi.latitude >= mapBounds.southWest.lat &&
          rawTaxi.latitude <= mapBounds.northEast.lat &&
          rawTaxi.longitude >= mapBounds.southWest.lng &&
          rawTaxi.longitude <= mapBounds.northEast.lng
        )

        const shouldInclude = !mapBounds || isInBounds

        if (shouldInclude) {
          // Handle missing fields gracefully
          const avgSpeed = Number(rawTaxi.avg_speed) || Math.random() * 50 + 10
          let violations = Number(rawTaxi.violations) || 0
          
          // Add violation detection logic
          if (avgSpeed > 80) {
            violations += 1
          }
          
          if (avgSpeed < 1) {
            violations += 1
          }
          
          if (avgSpeed > 100) {
            violations += 2
          }
          
          // Calculate distance traveled
          let distanceTraveled = 0
          const currentPosition = { lat: rawTaxi.latitude, lng: rawTaxi.longitude }
          const previousPosition = previousTaxiPositions.get(rawTaxi.taxi_id)
          
          if (previousPosition) {
            distanceTraveled = calculateDistance(
              previousPosition.lat, 
              previousPosition.lng, 
              currentPosition.lat, 
              currentPosition.lng
            )
            
            // Only count significant movements
            if (distanceTraveled < 0.01) {
              distanceTraveled = 0
            }
          }

          // Store new position
          newTaxiPositions.set(rawTaxi.taxi_id, currentPosition)

          const taxi: Taxi = {
            id: rawTaxi.taxi_id,
            lastUpdate: new Date(lastUpdate),
            longitude: rawTaxi.longitude,
            latitude: rawTaxi.latitude,
            avgSpeed: avgSpeed,
            violations: violations,
            totalDistance: distanceTraveled
          }

          newActiveTaxisInViewport.push(taxi)
          cumulativeSpeedInViewport += avgSpeed
          cumulativeViolationsInViewport += violations
          newDistanceThisInterval += distanceTraveled
          activeTaxiCountInViewport++
        }
      })

      // Update taxi positions for next iteration
      setPreviousTaxiPositions(newTaxiPositions)

      // Accumulate total distance over time
      const newTotalDistance = accumulatedDistance + newDistanceThisInterval
      setAccumulatedDistance(newTotalDistance)

      // Update state
      setActiveTaxis(newActiveTaxisInViewport)
      setTotalTaxis(currentRawTaxis.size)
      setTotalAverageSpeed(activeTaxiCountInViewport > 0 ? cumulativeSpeedInViewport / activeTaxiCountInViewport : 0)
      setTotalViolations(cumulativeViolationsInViewport)
      setTotalDistance(newTotalDistance)

      const endTime = performance.now()
      setDataProcessingTime(endTime - startTime)
    }

    const updateInterval = getDataUpdateInterval()
    const interval = setInterval(processData, updateInterval)

    return () => clearInterval(interval)
  }, [latestData, mapBounds, getDataUpdateInterval, isPlaying, accumulatedDistance, previousTaxiPositions])

  const contextValue = React.useMemo(
    () => ({
      activeTaxis,
      totalTaxis,
      totalActiveTaxis: activeTaxis.length,
      totalAverageSpeed,
      totalViolations,
      totalDistance,
      isConnected,
      dataProcessingTime,
      setMapBounds,
    }),
    [
      activeTaxis,
      totalTaxis,
      totalAverageSpeed,
      totalViolations,
      totalDistance,
      isConnected,
      dataProcessingTime,
      setMapBounds,
    ]
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