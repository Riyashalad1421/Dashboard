// lib/websocket.ts - UPDATED TO USE ENV VARIABLE
"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { RawTaxiData } from "@/lib/types"

// 🔧 FIXED: Use environment variable instead of hardcoded IP
const getWebSocketUrl = () => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
  // Convert HTTP URL to WebSocket URL
  const wsUrl = backendUrl.replace("http://", "ws://").replace("https://", "wss://")
  return `${wsUrl}/ws/taxi`
}

const WS_URL = getWebSocketUrl()

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const latestData = useRef<Map<string, RawTaxiData>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxReconnectAttempts = 10
  const reconnectAttemptRef = useRef(0)

  const getLatestData = useCallback(() => {
    return latestData.current
  }, [])

  const connect = useCallback(() => {
    try {
      console.log(`🔌 Connecting to WebSocket: ${WS_URL}`)
      ws.current = new WebSocket(WS_URL)

      ws.current.onopen = () => {
        console.log("✅ WebSocket connected successfully!")
        setIsConnected(true)
        reconnectAttemptRef.current = 0
      }

      ws.current.onmessage = (event) => {
        try {
          console.log(`📦 WebSocket message received (${event.data.length} bytes)`)
          
          const parsedData = JSON.parse(event.data)
          console.log("📊 Parsed data structure:", {
            type: typeof parsedData,
            isArray: Array.isArray(parsedData),
            length: Array.isArray(parsedData) ? parsedData.length : 'N/A'
          })

          if (Array.isArray(parsedData)) {
            console.log(`🚗 Processing ${parsedData.length} taxis from array`)
            
            const now = new Date()
            let processedCount = 0
            let invalidCount = 0

            parsedData.forEach((taxiObj, index) => {
              // Debug first few objects
              if (index < 2) {
                console.log(`🔍 Debug taxi ${index + 1}:`, {
                  taxi_id: taxiObj.taxi_id,
                  date_time: taxiObj.date_time,
                  last_updated: taxiObj.last_updated,
                  longitude: taxiObj.longitude,
                  latitude: taxiObj.latitude,
                  avg_speed: taxiObj.avg_speed,
                  violations: taxiObj.violations,
                  distance: taxiObj.distance
                })
              }

              // Check for required fields
              if (taxiObj && 
                  taxiObj.taxi_id && 
                  typeof taxiObj.longitude === 'number' && 
                  typeof taxiObj.latitude === 'number') {
                
                // ✅ FIX: Use current timestamp instead of old data timestamps
                // The CSV data has old timestamps from 2008, so we use current time
                const taxiData: RawTaxiData = {
                  taxi_id: String(taxiObj.taxi_id),
                  latitude: Number(taxiObj.latitude),
                  longitude: Number(taxiObj.longitude),
                  // ✅ CRITICAL FIX: Always use current timestamp for freshness
                  date_time: now.toISOString(),
                  avg_speed: Number(taxiObj.avg_speed || 0),
                  violations: Number(taxiObj.violations || 0)
                }

                // Validate Beijing coordinates (relaxed bounds)
                if (taxiData.latitude >= 38.0 && taxiData.latitude <= 42.0 &&
                    taxiData.longitude >= 114.0 && taxiData.longitude <= 119.0) {
                  
                  latestData.current.set(taxiData.taxi_id, taxiData)
                  processedCount++
                  
                  // Log first successful taxi for verification
                  if (processedCount === 1) {
                    console.log("✅ First valid taxi stored:", taxiData)
                  }
                } else {
                  invalidCount++
                  if (invalidCount <= 3) {
                    console.warn(`🚨 Invalid coordinates for taxi ${taxiData.taxi_id}: ${taxiData.latitude}, ${taxiData.longitude}`)
                  }
                }
              } else {
                invalidCount++
                if (invalidCount <= 3) {
                  console.warn(`🚨 Missing required fields in taxi object:`, {
                    hasId: !!taxiObj?.taxi_id,
                    hasLat: typeof taxiObj?.latitude === 'number',
                    hasLng: typeof taxiObj?.longitude === 'number',
                    object: taxiObj
                  })
                }
              }
            })

            console.log(`✅ Successfully processed: ${processedCount}/${parsedData.length} taxis`)
            console.log(`❌ Invalid/skipped: ${invalidCount} taxis`)
            console.log(`📊 Total in cache: ${latestData.current.size}`)

            // ✅ FIX: Only clean up taxis that haven't been updated in 5 minutes
            // Since we're using current timestamp, this prevents immediate cleanup
            const cutoffTime = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes
            let cleanedCount = 0
            latestData.current.forEach((taxi, id) => {
              if (new Date(taxi.date_time) < cutoffTime) {
                latestData.current.delete(id)
                cleanedCount++
              }
            })
            
            if (cleanedCount > 0) {
              console.log(`🧹 Cleaned up ${cleanedCount} old taxis`)
            }

            // Final verification
            console.log(`🎯 Final cache state: ${latestData.current.size} taxis stored`)
            if (latestData.current.size > 0) {
              const sampleTaxi = Array.from(latestData.current.values())[0]
              console.log("📝 Sample stored taxi:", sampleTaxi)
            }

          } else {
            console.warn("🚨 Received non-array data:", typeof parsedData, parsedData)
          }

        } catch (error) {
          console.error("❌ WebSocket message processing failed:", error)
          console.error("Raw data sample:", event.data.substring(0, 500))
        }
      }

      ws.current.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected: Code ${event.code}, Reason: ${event.reason}`)
        setIsConnected(false)
        
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000)
          reconnectAttemptRef.current++
          
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          console.error("❌ Max reconnection attempts reached")
        }
      }

      ws.current.onerror = (error) => {
        console.error("❌ WebSocket error:", error)
        setIsConnected(false)
      }

    } catch (error) {
      console.error("❌ Failed to create WebSocket:", error)
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [connect])

  return { latestData: getLatestData, isConnected }
}