// lib/api.ts - UPDATED TO USE ENV VARIABLE
import type { TaxiDetails, MapBounds } from "./types"

// 🔧 FIXED: Use environment variable instead of hardcoded IP
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

// Cache for API responses to reduce backend load
const apiCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 30000 // 30 seconds

function getCachedData<T>(key: string): T | null {
  const cached = apiCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  apiCache.delete(key)
  return null
}

function setCachedData(key: string, data: any): void {
  apiCache.set(key, { data, timestamp: Date.now() })
}

// ✅ FIXED: Updated to match FastAPI endpoint structure
export async function getTaxiViolations(taxiId: string) {
  try {
    console.log(`🚨 Fetching violations for taxi: ${taxiId}`)
    const res = await fetch(`${API_BASE_URL}/api/taxi/${taxiId}/violations`)
    if (!res.ok) {
      console.warn(`⚠️ Violations API returned ${res.status} for taxi ${taxiId}`)
      return []
    }
    const data = await res.json()
    console.log(`✅ Retrieved ${data.length || 0} violations for taxi ${taxiId}`)
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error("❌ Error in getTaxiViolations:", error)
    return [] // Return empty list to avoid frontend crash
  }
}

export async function getFleetSummary() {
  const cacheKey = "fleet-summary"
  const cached = getCachedData(cacheKey)
  if (cached) return cached

  try {
    console.log("📊 Fetching fleet summary...")
    const response = await fetch(`${API_BASE_URL}/fleet-summary`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    console.log("✅ Fleet summary retrieved:", data)
    setCachedData(cacheKey, data)
    return data
  } catch (error) {
    console.error("❌ Failed to fetch fleet summary:", error)
    return {
      totalTaxis: 0,
      avgSpeed: 0,
      totalDistance: 0,
      totalViolations: 0,
    }
  }
}

export async function getTaxiDetails(taxiId: string): Promise<TaxiDetails> {
  const cacheKey = `taxi-details-${taxiId}`
  const cached = getCachedData<TaxiDetails>(cacheKey)
  if (cached) return cached

  try {
    console.log(`🚗 Fetching details for taxi: ${taxiId}`)
    
    // ✅ FIXED: Use the correct endpoints and handle responses properly
    const [statusResponse, alertsResponse] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/status/${taxiId}`),
      fetch(`${API_BASE_URL}/alerts/${taxiId}`)
    ])

    // Process status response
    let statusData = null
    if (statusResponse.status === 'fulfilled' && statusResponse.value.ok) {
      statusData = await statusResponse.value.json()
    }

    // Process alerts response
    let alertsData = null
    if (alertsResponse.status === 'fulfilled' && alertsResponse.value.ok) {
      alertsData = await alertsResponse.value.json()
    }

    const details: TaxiDetails = {
      avgSpeed: statusData?.performance?.avg_speed || 0,
      violations: alertsData?.total_violations || statusData?.violations?.count || 0,
      totalDistance: statusData?.performance?.total_distance || 0
    }

    console.log(`✅ Taxi ${taxiId} details:`, details)
    setCachedData(cacheKey, details)
    return details

  } catch (error) {
    console.error(`❌ Failed to fetch taxi details for ${taxiId}:`, error)
    
    // Return placeholder data on error
    return {
      avgSpeed: 0,
      violations: 0,
      totalDistance: 0
    }
  }
}

export async function getTaxiAlerts(taxiId: string) {
  const cacheKey = `taxi-alerts-${taxiId}`
  const cached = getCachedData(cacheKey)
  if (cached) return cached

  try {
    console.log(`🚨 Fetching alerts for taxi: ${taxiId}`)
    const response = await fetch(`${API_BASE_URL}/alerts/${taxiId}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    const alerts = data.alerts || []
    console.log(`✅ Retrieved ${alerts.length} alerts for taxi ${taxiId}`)
    setCachedData(cacheKey, alerts)
    return alerts
  } catch (error) {
    console.error(`❌ Failed to fetch taxi alerts for ${taxiId}:`, error)
    return []
  }
}

// ✅ FIXED: Updated viewport function to match FastAPI endpoint
export async function getTaxisInViewport(bounds: MapBounds, limit: number = 200) {
  const cacheKey = `viewport-${bounds.northEast.lat}-${bounds.northEast.lng}-${bounds.southWest.lat}-${bounds.southWest.lng}-${limit}`
  const cached = getCachedData(cacheKey)
  if (cached) return cached

  try {
    const params = new URLSearchParams({
      north: bounds.northEast.lat.toString(),
      south: bounds.southWest.lat.toString(),
      east: bounds.northEast.lng.toString(),
      west: bounds.southWest.lng.toString(),
      limit: limit.toString()
    })

    console.log(`📍 Fetching taxis in viewport with bounds:`, bounds)
    const response = await fetch(`${API_BASE_URL}/snapshots/viewport?${params}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    console.log(`✅ Found ${data.count || 0} taxis in viewport`)
    setCachedData(cacheKey, data)
    return data
  } catch (error) {
    console.error("❌ Failed to fetch taxis in viewport:", error)
    return { data: [], count: 0 }
  }
}

// Test function to verify API connectivity
export async function testApiConnection(): Promise<boolean> {
  try {
    console.log("🔍 Testing API connection...")
    const response = await fetch(`${API_BASE_URL}/health`, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log("✅ API connection successful:", data)
      return true
    } else {
      console.error(`❌ API health check failed: ${response.status}`)
      return false
    }
  } catch (error) {
    console.error("❌ API connection test failed:", error)
    return false
  }
}

// Utility function to clear cache
export function clearApiCache() {
  apiCache.clear()
  console.log("🧹 API cache cleared")
}

// Utility function to get cache statistics
export function getCacheStats() {
  return {
    size: apiCache.size,
    keys: Array.from(apiCache.keys()),
    oldestEntry: Math.min(...Array.from(apiCache.values()).map(v => v.timestamp)),
    newestEntry: Math.max(...Array.from(apiCache.values()).map(v => v.timestamp))
  }
}

// 🔧 NEW: Debug function to check current API URL
export function getCurrentApiUrl() {
  console.log(`🔧 Current API_BASE_URL: ${API_BASE_URL}`)
  return API_BASE_URL
}