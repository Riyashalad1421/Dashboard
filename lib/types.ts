// lib/types.ts - UPDATED TO MATCH FASTAPI RESPONSE
export interface RawTaxiData {
  taxi_id: string
  latitude: number
  longitude: number
  date_time: string // "YYYY-MM-DD HH:MM:SS" or ISO string
  avg_speed: number
  violations: number
  // Optional fields that might come from FastAPI
  last_updated?: string
  distance?: number
  update_frequency?: number
}

export interface Taxi {
  id: string
  lastUpdate: Date
  longitude: number
  latitude: number
  avgSpeed: number
  violations: number
  totalDistance?: number
}

export interface MapBounds {
  northEast: { lat: number; lng: number }
  southWest: { lat: number; lng: number }
}

export interface TaxiDetails {
  avgSpeed: number
  violations: number
  totalDistance: number
}