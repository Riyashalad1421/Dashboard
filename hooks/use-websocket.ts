"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { RawTaxiData } from "@/lib/types"

const WS_URL = "ws://192.168.2.140:8000/ws/taxi"

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const latestData = useRef<Map<string, RawTaxiData>>(new Map())
  const [isConnected, setIsConnected] = useState(false)

  const getLatestData = useCallback(() => {
    return latestData.current
  }, [])

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(WS_URL)

      ws.current.onopen = () => {
        console.log("WebSocket connected")
        setIsConnected(true)
      }

      ws.current.onmessage = (event) => {
        try {
          // CORRECTED: Parse as an array of RawTaxiData objects
          const newTaxis: RawTaxiData[] = JSON.parse(event.data)
          const now = new Date()

          // Update latestData map for each taxi in the received array
          newTaxis.forEach((taxi) => {
            latestData.current.set(taxi.taxi_id, { ...taxi, date_time: now.toISOString() }) // Use current time for freshness
          })

          // Clean up old taxis (e.g., older than 30 seconds if no new updates)
          const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000)
          latestData.current.forEach((taxi, id) => {
            if (new Date(taxi.date_time) < thirtySecondsAgo) {
              latestData.current.delete(id)
            }
          })
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error)
        }
      }

      ws.current.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason)
        setIsConnected(false)
        // Attempt to reconnect after a delay
        setTimeout(connect, 3000)
      }

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error)
        ws.current?.close()
      }
    }

    connect()

    return () => {
      ws.current?.close()
    }
  }, [])

  return { latestData: getLatestData, isConnected }
}
